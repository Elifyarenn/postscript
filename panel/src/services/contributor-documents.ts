/**
 * Documents prepared for the contributors to sign by hand (D-276): the
 * Genel Katkı Sağlayan Sözleşmesi of the current version for every
 * contributor, and an Eser Bazlı Kullanım Ruhsatı Formu for every work, on
 * the account of the work's own author.
 *
 * Preparing is all this does. Nothing is sent (mail goes out only when an
 * admin asks for it per person, `mailContributorDocuments`, D-285), no
 * work is licensed, and no work, author or status is touched — the records
 * are only read. A value the records do not hold, or hold doubtfully, is not
 * filled in: the document is kept as `needs_review` with the reason.
 *
 * Running it again adds only what is missing. A prepared document is never
 * rewritten (someone may already have signed its PDF); a document waiting for
 * review is tried again, in place, so fixing the data resolves it.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  agreementVersions,
  articles,
  contributorDocuments,
  rightsGrants,
  users,
  type AgreementVersion,
  type ContributorDocument,
  type User,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { hashDocument } from "@/lib/agreement/normalise";
import {
  AgreementRenderError,
  buildPlaceholders,
  escapeForTemplate,
  fillTemplate,
  formatContractDate,
  OPTIONAL,
  previewTemplate,
} from "@/lib/agreement/render";
import {
  ACCEPTED_WORK_STATUSES,
  CONTRIBUTOR_AGREEMENT_FILE,
  contributionRoleLabel,
  DOCUMENT_KIND_LABELS,
  LICENCE_FORM_FILE,
  LICENCE_FORM_TEMPLATE_VERSION,
  licenceFormValues,
  reasonForPlaceholder,
  wordCount,
  type ContributorDocumentKind,
} from "@/lib/contributor-documents";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { renderDocumentPdf } from "@/lib/pdf";
import { env } from "@/lib/env";
import { enqueueMails, sendMail, type OutgoingMail } from "@/services/mail-queue";
import * as templates from "@emails/templates";
import { buildAgreementContext, getCurrentAgreement, stripMarkdown } from "./agreements";
import { articleHash, LICENCE_TERMS } from "./rights";
import type { RequestMeta } from "./auth";

function readContract(file: string): string {
  return readFileSync(path.join(process.cwd(), "contracts", file), "utf8");
}

/** What a render left unfilled, as reasons a person can act on. */
function reasonsOf(error: unknown): string[] {
  if (error instanceof AgreementRenderError) return error.placeholders.map(reasonForPlaceholder);
  throw error;
}

export type PreparationSummary = {
  generalCreated: number;
  licenceCreated: number;
  /** needs_review documents made or re-checked in this run, by reason. */
  needsReview: { total: number; reasons: Record<string, number> };
  /** needs_review documents that this run could now prepare. */
  resolved: number;
  /** Already present and prepared: left exactly as they were. */
  alreadyPrepared: { general: number; licence: number };
  /** Records no document could be attached to. */
  skipped: { reason: string; count: number }[];
};

type Draft = {
  status: "prepared" | "needs_review";
  reasons: string[];
  markdown: string | null;
  hash: string | null;
};

function draft(reasons: string[], rendered: { markdown: string; hash: string } | null): Draft {
  return reasons.length === 0 && rendered
    ? { status: "prepared", reasons: [], markdown: rendered.markdown, hash: rendered.hash }
    : { status: "needs_review", reasons, markdown: null, hash: null };
}

/** The contract for one contributor, from the current version's own text. */
async function draftGeneral(
  version: AgreementVersion,
  person: User,
  hasWorks: boolean,
  versionReason: string | null,
): Promise<Draft> {
  const reasons: string[] = [];
  if (versionReason) reasons.push(versionReason);
  if (person.isBanned) reasons.push("Hesap yasaklı");

  let rendered: { markdown: string; hash: string } | null = null;
  try {
    rendered = fillTemplate(version.bodyMarkdown, await generalValues(version, person, hasWorks), OPTIONAL);
  } catch (error) {
    reasons.push(...reasonsOf(error));
  }
  return draft(reasons, rendered);
}

/** The contract's values for one person; the draft and the preview share them. */
async function generalValues(version: AgreementVersion, person: User, hasWorks: boolean) {
  const context = await buildAgreementContext(version, {
    ...person,
    contributionRole: contributionRoleLabel({ role: person.role, isIllustrator: person.isIllustrator, hasWorks }),
  });
  return buildPlaceholders(context);
}

type WorkRow = typeof articles.$inferSelect;

/** The licence form for one work, filled from the work and its author's records. */
async function draftLicence(
  version: AgreementVersion,
  work: WorkRow,
  author: User,
  bylineChoice: "real_name" | "pen_name" | null,
  formId: string,
  now: Date,
  versionReason: string | null,
): Promise<Draft & { contentHash: string | null }> {
  const reasons: string[] = [];
  if (versionReason) reasons.push(versionReason);
  if (work.status === "withdrawn") {
    reasons.push("Eser geri çekildi");
  } else if (!ACCEPTED_WORK_STATUSES.includes(work.status)) {
    reasons.push(`Eser henüz Dergi tarafından kabul edilmedi (durum: ${work.status})`);
  }

  const { values, words, contentHash } = await licenceValues(version, work, author, bylineChoice, formId, now);
  if (words === 0) reasons.push("Eser metni boş");

  let rendered: { markdown: string; hash: string } | null = null;
  try {
    const filled = fillTemplate(readContract(LICENCE_FORM_FILE), values);
    const hash = hashDocument(filled.markdown);
    rendered = { markdown: filled.markdown.replace("{{form.text_hash}}", hash), hash };
  } catch (error) {
    reasons.push(...reasonsOf(error));
  }
  return { ...draft([...new Set(reasons)], rendered), contentHash };
}

/** The form's values for one work; the draft and the preview share them. */
async function licenceValues(
  version: AgreementVersion,
  work: WorkRow,
  author: User,
  bylineChoice: "real_name" | "pen_name" | null,
  formId: string,
  now: Date,
) {
  const body = work.bodyMarkdown ?? "";
  const words = wordCount(body);
  const contentHash = body.trim() ? articleHash(body) : null;

  // The same person and publisher values the contract uses, under the form's names
  const context = await buildAgreementContext(version, { ...author, contributionRole: "Yazar" });
  const values: Record<string, string | null> = {
    ...buildPlaceholders(context),
    "eser.baslik": work.title.trim() ? escapeForTemplate(work.title) : null,
    "eser.tur": "Yazı (metin)",
    "eser.teknik_tanim": words > 0 ? `Panel kaydındaki metin, ${words} kelime` : null,
    "eser.content_hash": contentHash,
    "eser.id": work.id,
    "form.id": formId,
    "form.template_version": LICENCE_FORM_TEMPLATE_VERSION,
    "form.created_at": formatContractDate(now),
    ...licenceFormValues({
      terms: LICENCE_TERMS,
      bylineChoice,
      displayName: escapeForTemplate(author.displayName),
      penName: author.penName ? escapeForTemplate(author.penName) : null,
    }),
    // Filled after the fact: the hash covers the text with this field unfilled
    "form.text_hash": "{{form.text_hash}}",
  };
  return { values, words, contentHash };
}

/**
 * Prepares every missing document. Admin only; sends nothing.
 */
export async function prepareContributorDocuments(actor: Actor, meta: RequestMeta): Promise<PreparationSummary> {
  if (!canManageAgreements(actor)) throw forbidden();

  const version = await getCurrentAgreement();
  if (!version) throw conflict("Yayınlanmış bir sözleşme sürümü yok; önce bir sürüm yayınlayın.");
  // The current version is used as it stands; if it is not the contributor
  // contract's text, the documents wait for review rather than pretend
  const versionReason =
    version.bodyHash === hashDocument(readContract(CONTRIBUTOR_AGREEMENT_FILE))
      ? null
      : `Güncel sözleşme sürümü (v${version.version}) Genel Katkı Sağlayan Sözleşmesi metni değil`;

  const summary: PreparationSummary = {
    generalCreated: 0,
    licenceCreated: 0,
    needsReview: { total: 0, reasons: {} },
    resolved: 0,
    alreadyPrepared: { general: 0, licence: 0 },
    skipped: [],
  };
  const skip = (reason: string) => {
    const found = summary.skipped.find((entry) => entry.reason === reason);
    if (found) found.count += 1;
    else summary.skipped.push({ reason, count: 1 });
  };
  const count = (result: Draft) => {
    if (result.status !== "needs_review") return;
    summary.needsReview.total += 1;
    for (const reason of result.reasons) {
      summary.needsReview.reasons[reason] = (summary.needsReview.reasons[reason] ?? 0) + 1;
    }
  };
  const now = new Date();

  /* ---- Works, and who wrote them ---- */
  const works = await db.select().from(articles).where(isNull(articles.deletedAt));
  const authorIds = new Set(works.flatMap((work) => (work.authorId ? [work.authorId] : [])));

  /* ---- Contributors: writers, çizerler, and anyone who wrote a work ---- */
  const people = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.role, "writer"),
        eq(users.isIllustrator, true),
        authorIds.size ? inArray(users.id, [...authorIds]) : sql`false`,
      ),
    );
  const byId = new Map(people.map((person) => [person.id, person]));

  const existing = await db.select().from(contributorDocuments);
  const generalOf = new Map(
    existing
      .filter((row) => row.kind === "general_agreement" && row.agreementVersionId === version.id)
      .map((row) => [row.userId, row]),
  );
  const licenceOf = new Map(
    existing
      .filter((row) => row.kind === "work_licence" && row.templateVersion === LICENCE_FORM_TEMPLATE_VERSION)
      .map((row) => [row.articleId, row]),
  );

  const save = async (
    kind: ContributorDocumentKind,
    current: ContributorDocument | undefined,
    values: { userId: string; articleId: string | null; id?: string; templateVersion: string; contentHash?: string | null },
    result: Draft,
  ): Promise<void> => {
    count(result);
    const fields = {
      status: result.status,
      reviewReasons: result.reasons,
      renderedMarkdown: result.markdown,
      textHash: result.hash,
      workContentHash: values.contentHash ?? null,
      updatedAt: now,
    };
    if (current) {
      // Only a document waiting for review is tried again; a prepared one stays
      await db
        .update(contributorDocuments)
        .set(fields)
        .where(and(eq(contributorDocuments.id, current.id), eq(contributorDocuments.status, "needs_review")));
      if (result.status === "prepared") summary.resolved += 1;
      return;
    }
    const [row] = await db
      .insert(contributorDocuments)
      .values({
        ...(values.id ? { id: values.id } : {}),
        kind,
        userId: values.userId,
        agreementVersionId: version.id,
        articleId: values.articleId,
        templateVersion: values.templateVersion,
        createdBy: actor.id,
        ...fields,
      })
      .onConflictDoNothing()
      .returning({ id: contributorDocuments.id });
    // A parallel run made it first: counted as present, not created
    if (!row) return;
    if (kind === "general_agreement") summary.generalCreated += 1;
    else summary.licenceCreated += 1;
  };

  for (const person of people) {
    if (person.deletedAt) {
      skip("Hesap silinmiş: genel sözleşme hazırlanmadı");
      continue;
    }
    const current = generalOf.get(person.id);
    if (current?.status === "prepared") {
      summary.alreadyPrepared.general += 1;
      continue;
    }
    const result = await draftGeneral(version, person, authorIds.has(person.id), versionReason);
    await save("general_agreement", current, { userId: person.id, articleId: null, templateVersion: String(version.version) }, result);
  }

  // The author's own signed choice of byline, where the old approval recorded one
  const signedChoices = await db
    .select({ articleId: rightsGrants.articleId, bylineChoice: rightsGrants.bylineChoice, signedAt: rightsGrants.signedAt })
    .from(rightsGrants)
    .where(eq(rightsGrants.status, "signed"))
    .orderBy(desc(rightsGrants.signedAt));
  const bylineOf = new Map<string, "real_name" | "pen_name" | null>();
  for (const row of signedChoices) if (!bylineOf.has(row.articleId)) bylineOf.set(row.articleId, row.bylineChoice);

  for (const work of works) {
    const author = work.authorId ? byId.get(work.authorId) : undefined;
    if (!author) {
      skip("Eserin sahibi (yazarı) kayıtlı değil: ruhsat hiçbir hesaba bağlanamadı");
      continue;
    }
    if (author.deletedAt) {
      skip("Eserin sahibinin hesabı silinmiş: ruhsat hazırlanmadı");
      continue;
    }
    const current = licenceOf.get(work.id);
    if (current?.status === "prepared") {
      summary.alreadyPrepared.licence += 1;
      continue;
    }
    const formId = current?.id ?? randomUUID();
    const result = await draftLicence(version, work, author, bylineOf.get(work.id) ?? null, formId, now, versionReason);
    await save(
      "work_licence",
      current,
      { id: formId, userId: author.id, articleId: work.id, templateVersion: LICENCE_FORM_TEMPLATE_VERSION, contentHash: result.contentHash },
      result,
    );
  }

  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.prepared",
    entityType: "agreement_versions",
    entityId: version.id,
    after: {
      generalCreated: summary.generalCreated,
      licenceCreated: summary.licenceCreated,
      needsReview: summary.needsReview.total,
      resolved: summary.resolved,
    },
    ip: meta.ip,
  });
  return summary;
}

/**
 * Deletes every prepared document so they can be prepared again from the
 * current templates (D-281). They are drafts: nothing was sent, and a signed
 * copy lives in `signed_contracts`, which this does not touch.
 */
export async function clearContributorDocuments(actor: Actor, meta: RequestMeta): Promise<number> {
  if (!canManageAgreements(actor)) throw forbidden();
  const removed = await db.delete(contributorDocuments).returning({ id: contributorDocuments.id });
  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.cleared",
    entityType: "contributor_documents",
    after: { removed: removed.length },
    ip: meta.ip,
  });
  return removed.length;
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type ContributorDocumentItem = {
  id: string;
  kind: ContributorDocumentKind;
  status: "prepared" | "needs_review";
  reviewReasons: string[];
  templateVersion: string;
  textHash: string | null;
  createdAt: Date;
  userId: string;
  userName: string;
  userRole: string;
  articleId: string | null;
  articleTitle: string | null;
  articleStatus: string | null;
};

const owners = alias(users, "owners");

function documentList() {
  return db
    .select({
      id: contributorDocuments.id,
      kind: contributorDocuments.kind,
      status: contributorDocuments.status,
      reviewReasons: contributorDocuments.reviewReasons,
      templateVersion: contributorDocuments.templateVersion,
      textHash: contributorDocuments.textHash,
      createdAt: contributorDocuments.createdAt,
      userId: owners.id,
      userName: owners.displayName,
      userRole: owners.role,
      articleId: articles.id,
      articleTitle: articles.title,
      articleStatus: articles.status,
    })
    .from(contributorDocuments)
    .innerJoin(owners, eq(contributorDocuments.userId, owners.id))
    .leftJoin(articles, eq(contributorDocuments.articleId, articles.id));
}

/** The contributor's own documents; nobody else's. */
export async function listOwnContributorDocuments(actor: Actor): Promise<ContributorDocumentItem[]> {
  return documentList()
    .where(eq(contributorDocuments.userId, actor.id))
    .orderBy(contributorDocuments.kind, contributorDocuments.createdAt);
}

/** Every document with its account and work, for the admin to check. */
export async function listContributorDocuments(actor: Actor): Promise<ContributorDocumentItem[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  return documentList().orderBy(owners.displayName, contributorDocuments.kind, contributorDocuments.createdAt);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContributorDocumentView = {
  item: ContributorDocumentItem;
  ownerEmail: string;
  /** The text as prepared, or for a document under review a marked preview. */
  markdown: string | null;
  /** True when `markdown` is a preview with its gaps marked, not the document. */
  isPreview: boolean;
  /** Why no text could be shown at all (the work or the version is gone). */
  unavailable: string | null;
};

/**
 * One document, for the admin to read (D-278). A prepared one is shown exactly
 * as stored. One under review has no text yet, so it is drawn from today's
 * records with every missing value marked in place of a guess; that preview is
 * never saved and has no PDF.
 */
export async function viewContributorDocument(actor: Actor, id: string): Promise<ContributorDocumentView> {
  if (!canManageAgreements(actor)) throw forbidden();
  if (!UUID.test(id)) throw notFound("Belge bulunamadı.");

  const [item] = await documentList().where(eq(contributorDocuments.id, id)).limit(1);
  const [row] = await db.select().from(contributorDocuments).where(eq(contributorDocuments.id, id)).limit(1);
  if (!item || !row) throw notFound("Belge bulunamadı.");
  const [owner] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const base = { item, ownerEmail: owner!.email };

  if (row.status === "prepared" && row.renderedMarkdown) {
    return { ...base, markdown: row.renderedMarkdown, isPreview: false, unavailable: null };
  }

  const [version] = row.agreementVersionId
    ? await db.select().from(agreementVersions).where(eq(agreementVersions.id, row.agreementVersionId)).limit(1)
    : [];
  if (!version) return { ...base, markdown: null, isPreview: true, unavailable: "Belgenin sözleşme sürümü bulunamadı." };

  const gap = (name: string) => `**[EKSİK: ${reasonForPlaceholder(name)}]**`;

  if (row.kind === "general_agreement") {
    const [authored] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.authorId, owner!.id), isNull(articles.deletedAt)))
      .limit(1);
    const values = await generalValues(version, owner!, Boolean(authored));
    return { ...base, markdown: previewTemplate(version.bodyMarkdown, values, OPTIONAL, gap).markdown, isPreview: true, unavailable: null };
  }

  const [work] = row.articleId ? await db.select().from(articles).where(eq(articles.id, row.articleId)).limit(1) : [];
  if (!work) return { ...base, markdown: null, isPreview: true, unavailable: "Belgenin eseri artık kayıtlı değil." };
  const [grant] = await db
    .select({ bylineChoice: rightsGrants.bylineChoice })
    .from(rightsGrants)
    .where(and(eq(rightsGrants.articleId, work.id), eq(rightsGrants.status, "signed")))
    .orderBy(desc(rightsGrants.signedAt))
    .limit(1);
  const { values } = await licenceValues(version, work, owner!, grant?.bylineChoice ?? null, row.id, row.updatedAt);
  values["form.text_hash"] = "(belge hazır olunca hesaplanır)";
  return {
    ...base,
    markdown: previewTemplate(readContract(LICENCE_FORM_FILE), values, new Set(), gap).markdown,
    isPreview: true,
    unavailable: null,
  };
}

/**
 * The PDF of one prepared document, for its owner or an admin. Anyone else
 * gets "not found", the same answer a missing id gives.
 */
export async function contributorDocumentPdf(
  actor: Actor,
  id: string,
): Promise<{ fileName: string; body: Buffer }> {
  // A malformed id is simply not a document, never a database error
  if (!UUID.test(id)) throw notFound("Belge bulunamadı.");
  const [row] = await db.select().from(contributorDocuments).where(eq(contributorDocuments.id, id)).limit(1);
  if (!row || (row.userId !== actor.id && !canManageAgreements(actor))) throw notFound("Belge bulunamadı.");
  if (row.status !== "prepared" || !row.renderedMarkdown || !row.textHash) {
    throw conflict("Bu belge incelemede; PDF'i hazır değil.");
  }
  return pdfOf(row);
}

/** The PDF of a prepared document, drawn from its stored text: the panel and the mail send the same file. */
async function pdfOf(row: ContributorDocument): Promise<{ fileName: string; body: Buffer }> {
  if (!row.renderedMarkdown || !row.textHash) throw conflict("Bu belge incelemede; PDF'i hazır değil.");
  const body = await renderDocumentPdf({
    title: `postscript ${DOCUMENT_KIND_LABELS[row.kind]}`,
    sections: [{ body: stripMarkdown(row.renderedMarkdown) }],
    footerNote: `Belge no ${row.id} — metin özeti (SHA-256) ${row.textHash.slice(0, 16)}…`,
  });
  const name = row.kind === "general_agreement" ? `genel-katki-saglayan-sozlesmesi-v${row.templateVersion}` : `eser-ruhsati-${row.id.slice(0, 8)}`;
  return { fileName: `${name}.pdf`, body };
}

type PreparedRow = { document: ContributorDocument; articleTitle: string | null };

function preparedRows(condition: SQL): Promise<PreparedRow[]> {
  return db
    .select({ document: contributorDocuments, articleTitle: articles.title })
    .from(contributorDocuments)
    .leftJoin(articles, eq(contributorDocuments.articleId, articles.id))
    .where(condition)
    .orderBy(contributorDocuments.userId, contributorDocuments.kind, contributorDocuments.createdAt);
}

/** One person's mail: every prepared document as a PDF attachment. */
async function documentsMail(person: User, rows: PreparedRow[]): Promise<OutgoingMail> {
  const attachments = [];
  for (const { document } of rows) {
    const pdf = await pdfOf(document);
    attachments.push({ filename: pdf.fileName, content: pdf.body, contentType: "application/pdf" });
  }
  const message = templates.contributorDocumentsSent({
    displayName: person.displayName,
    documents: rows.map(({ document, articleTitle }) =>
      articleTitle ? `${DOCUMENT_KIND_LABELS[document.kind]} — ${articleTitle}` : DOCUMENT_KIND_LABELS[document.kind],
    ),
    url: `${env().APP_URL}/account`,
  });
  return { to: person.email, ...message, attachments };
}

/**
 * Writes every contributor's documents mail to the outbox and stops there
 * (D-286): nothing is delivered by this call. The admin sends the batch from
 * /admin/mail with "Kuyruğu şimdi işle"; the daily cron would also pick it up.
 * The same set of documents is never queued twice for a person, so a second
 * press adds only people whose documents changed.
 */
export async function queueAllContributorDocuments(
  actor: Actor,
  meta: RequestMeta,
): Promise<{ mails: number; documents: number; alreadyQueued: number }> {
  if (!canManageAgreements(actor)) throw forbidden();

  const rows = await preparedRows(eq(contributorDocuments.status, "prepared"));
  const byUser = new Map<string, PreparedRow[]>();
  for (const row of rows) byUser.set(row.document.userId, [...(byUser.get(row.document.userId) ?? []), row]);
  if (byUser.size === 0) return { mails: 0, documents: 0, alreadyQueued: 0 };

  const people = await db
    .select()
    .from(users)
    .where(and(inArray(users.id, [...byUser.keys()]), isNull(users.deletedAt)));

  const mails: OutgoingMail[] = [];
  for (const person of people) {
    const own = byUser.get(person.id)!;
    const key = hashDocument(own.map(({ document }) => `${document.id}:${document.textHash}`).join("|"));
    mails.push({ ...(await documentsMail(person, own)), dedupeKey: `contributor_documents:${person.id}:${key}` });
  }

  // Stored only: enqueueMails does not start a delivery
  const ids = await enqueueMails(mails);
  const alreadyQueued = mails.length - ids.length;
  const documents = people.reduce((sum, person) => sum + byUser.get(person.id)!.length, 0);

  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.queued",
    entityType: "contributor_documents",
    after: { mails: ids.length, alreadyQueued, documents },
    ip: meta.ip,
  });
  return { mails: ids.length, documents, alreadyQueued };
}

/**
 * Mails one contributor their prepared documents as PDF attachments (D-285).
 * Only an admin's explicit action calls this; preparing documents never
 * sends anything. A document still under review is not sent.
 */
export async function mailContributorDocuments(
  actor: Actor,
  userId: string,
  meta: RequestMeta,
): Promise<{ sent: number }> {
  if (!canManageAgreements(actor)) throw forbidden();
  if (!UUID.test(userId)) throw notFound("Kullanıcı bulunamadı.");

  const [person] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!person) throw notFound("Kullanıcı bulunamadı.");

  const rows = await preparedRows(and(eq(contributorDocuments.userId, userId), eq(contributorDocuments.status, "prepared"))!);
  if (rows.length === 0) throw conflict("Bu kullanıcının hazır belgesi yok; incelemedeki belgeler gönderilmez.");

  await sendMail(await documentsMail(person, rows));

  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.mailed",
    entityType: "users",
    entityId: person.id,
    after: { documentIds: rows.map(({ document }) => document.id) },
    ip: meta.ip,
  });
  return { sent: rows.length };
}
