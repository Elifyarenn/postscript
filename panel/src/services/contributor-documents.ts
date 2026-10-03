/**
 * Documents prepared for the contributors to sign by hand (D-276): the
 * Genel Katkı Sağlayan Sözleşmesi of the current version for every
 * contributor, and an Eser Bazlı Kullanım Ruhsatı Formu for every work, on
 * the account of the work's own author. A work is an article, or an issue's
 * quiz whose author the admin has named (D-300).
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
import { and, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  agreementVersions,
  articles,
  contributorDocuments,
  issueQuizzes,
  issues,
  mailJobs,
  rightsGrants,
  signedContracts,
  users,
  type AgreementVersion,
  type ContributorDocument,
  type User,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, needsAuthorAgreement, type Actor } from "@/lib/auth/rbac";
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
import { parseOutcomes, parseQuestions, quizWorkText } from "@/lib/issue-quiz";
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

/** What a licence form names: the same few facts, whatever kind of work it is. */
type LicensedWork = {
  id: string;
  title: string;
  /** The text the form's hash and word count are taken from. */
  body: string;
  typeLabel: string;
  describe: (words: number) => string;
};

function articleWork(row: typeof articles.$inferSelect): LicensedWork {
  return {
    id: row.id,
    title: row.title,
    body: row.bodyMarkdown ?? "",
    typeLabel: "Yazı (metin)",
    describe: (words) => `Panel kaydındaki metin, ${words} kelime`,
  };
}

function quizWork(row: typeof issueQuizzes.$inferSelect): LicensedWork {
  const questions = parseQuestions(row.questions);
  const outcomes = parseOutcomes(row.outcomes);
  return {
    id: row.id,
    title: row.title,
    body: questions.length ? quizWorkText({ title: row.title, intro: row.intro, questions, outcomes }) : "",
    typeLabel: "Test (soru, seçenek ve sonuç metinleri)",
    describe: (words) =>
      `Panel kaydındaki test: ${questions.length} soru${outcomes.length ? `, ${outcomes.length} sonuç metni` : ""}, ${words} kelime`,
  };
}

/** The work a licence document is for, as it stands now; null when it is gone. */
async function workOf(row: ContributorDocument): Promise<LicensedWork | null> {
  if (row.quizId) {
    const [quiz] = await db.select().from(issueQuizzes).where(eq(issueQuizzes.id, row.quizId)).limit(1);
    return quiz ? quizWork(quiz) : null;
  }
  const [article] = row.articleId ? await db.select().from(articles).where(eq(articles.id, row.articleId)).limit(1) : [];
  return article ? articleWork(article) : null;
}

/** The title a list shows for a document's work, article or quiz. */
const workTitle = sql<string | null>`coalesce(${articles.title}, ${issueQuizzes.title})`;

/** The licence form for one work, filled from the work and its author's records. */
async function draftLicence(
  version: AgreementVersion,
  work: LicensedWork,
  author: User,
  bylineChoice: "real_name" | "pen_name" | null,
  formId: string,
  now: Date,
  versionReason: string | null,
): Promise<Draft & { contentHash: string | null }> {
  const reasons: string[] = [];
  if (versionReason) reasons.push(versionReason);
  // The work's status is not a condition: every listed work gets its form (D-287)

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
  work: LicensedWork,
  author: User,
  bylineChoice: "real_name" | "pen_name" | null,
  formId: string,
  now: Date,
) {
  const body = work.body;
  const words = wordCount(body);
  const contentHash = body.trim() ? articleHash(body) : null;

  // The same person and publisher values the contract uses, under the form's names
  const context = await buildAgreementContext(version, { ...author, contributionRole: "Yazar" });
  const values: Record<string, string | null> = {
    ...buildPlaceholders(context),
    "eser.baslik": work.title.trim() ? escapeForTemplate(work.title) : null,
    "eser.tur": work.typeLabel,
    "eser.teknik_tanim": words > 0 ? work.describe(words) : null,
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
  // Quizzes count as works once the admin has said who wrote them (D-300)
  const quizzes = (
    await db
      .select({ quiz: issueQuizzes })
      .from(issueQuizzes)
      .innerJoin(issues, eq(issueQuizzes.issueId, issues.id))
      .where(isNull(issues.deletedAt))
  ).flatMap(({ quiz }) => (quiz.authorId ? [quiz] : []));
  const authorIds = new Set([
    ...works.flatMap((work) => (work.authorId ? [work.authorId] : [])),
    ...quizzes.map((quiz) => quiz.authorId!),
  ]);

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
  const quizLicenceOf = new Map(
    existing
      .filter((row) => row.kind === "work_licence" && row.quizId && row.templateVersion === LICENCE_FORM_TEMPLATE_VERSION)
      .map((row) => [row.quizId, row]),
  );

  const save = async (
    kind: ContributorDocumentKind,
    current: ContributorDocument | undefined,
    values: {
      userId: string;
      articleId: string | null;
      quizId?: string | null;
      id?: string;
      templateVersion: string;
      contentHash?: string | null;
    },
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
        quizId: values.quizId ?? null,
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
    if (!needsAuthorAgreement(person)) {
      skip(ADMIN_SKIP);
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
    if (!needsAuthorAgreement(author)) {
      skip(ADMIN_SKIP);
      continue;
    }
    const current = licenceOf.get(work.id);
    if (current?.status === "prepared") {
      summary.alreadyPrepared.licence += 1;
      continue;
    }
    const formId = current?.id ?? randomUUID();
    const result = await draftLicence(version, articleWork(work), author, bylineOf.get(work.id) ?? null, formId, now, versionReason);
    await save(
      "work_licence",
      current,
      { id: formId, userId: author.id, articleId: work.id, templateVersion: LICENCE_FORM_TEMPLATE_VERSION, contentHash: result.contentHash },
      result,
    );
  }

  for (const quiz of quizzes) {
    const author = byId.get(quiz.authorId!);
    if (!author || author.deletedAt) {
      skip("Testin sahibinin hesabı silinmiş: ruhsat hazırlanmadı");
      continue;
    }
    if (!needsAuthorAgreement(author)) {
      skip(ADMIN_SKIP);
      continue;
    }
    const current = quizLicenceOf.get(quiz.id);
    if (current?.status === "prepared") {
      summary.alreadyPrepared.licence += 1;
      continue;
    }
    const formId = current?.id ?? randomUUID();
    // A quiz carries no byline choice: the form names its author (D-284)
    const result = await draftLicence(version, quizWork(quiz), author, null, formId, now, versionReason);
    await save(
      "work_licence",
      current,
      { id: formId, userId: author.id, articleId: null, quizId: quiz.id, templateVersion: LICENCE_FORM_TEMPLATE_VERSION, contentHash: result.contentHash },
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
/** No signed copy was uploaded for the document; only such a document may be deleted. */
export const withoutSignedCopy = sql`not exists (select 1 from ${signedContracts} where ${signedContracts.contributorDocumentId} = ${contributorDocuments.id})`;

export async function clearContributorDocuments(actor: Actor, meta: RequestMeta): Promise<number> {
  if (!canManageAgreements(actor)) throw forbidden();
  // A document someone has uploaded a signed copy of stays (D-289)
  const removed = await db
    .delete(contributorDocuments)
    .where(withoutSignedCopy)
    .returning({ id: contributorDocuments.id });
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
      // A quiz's licence shows the quiz's title in the same column (D-300)
      articleTitle: workTitle,
      articleStatus: articles.status,
    })
    .from(contributorDocuments)
    .innerJoin(owners, eq(contributorDocuments.userId, owners.id))
    .leftJoin(articles, eq(contributorDocuments.articleId, articles.id))
    .leftJoin(issueQuizzes, eq(contributorDocuments.quizId, issueQuizzes.id));
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
    const [quizzed] = await db
      .select({ id: issueQuizzes.id })
      .from(issueQuizzes)
      .where(eq(issueQuizzes.authorId, owner!.id))
      .limit(1);
    const values = await generalValues(version, owner!, Boolean(authored ?? quizzed));
    return { ...base, markdown: previewTemplate(version.bodyMarkdown, values, OPTIONAL, gap).markdown, isPreview: true, unavailable: null };
  }

  const work = await workOf(row);
  if (!work) return { ...base, markdown: null, isPreview: true, unavailable: "Belgenin eseri artık kayıtlı değil." };
  const [grant] = await db
    .select({ bylineChoice: rightsGrants.bylineChoice })
    .from(rightsGrants)
    .where(and(eq(rightsGrants.articleId, row.articleId ?? row.id), eq(rightsGrants.status, "signed")))
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
    .select({ document: contributorDocuments, articleTitle: workTitle })
    .from(contributorDocuments)
    .leftJoin(articles, eq(contributorDocuments.articleId, articles.id))
    .leftJoin(issueQuizzes, eq(contributorDocuments.quizId, issueQuizzes.id))
    .where(condition)
    .orderBy(contributorDocuments.userId, contributorDocuments.kind, contributorDocuments.createdAt);
}

/**
 * Nothing is asked of a writer the admin has frozen (D-299): no bulk documents
 * mail, no place in the awaiting list, no reminder. Their documents stay as
 * they are, and they are asked again once set active.
 */
const notFrozen = () =>
  and(
    or(isNull(users.writerStatus), ne(users.writerStatus, "suspended")),
    // Nor of an admin, who signs no contract (D-305)
    ne(users.role, "admin"),
  );

/** Why an admin's contract and licence forms are not prepared (D-305). */
const ADMIN_SKIP = "Yönetici: dergiyi kuran adminlerden sözleşme ve ruhsat istenmez";

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
    .where(and(inArray(users.id, [...byUser.keys()]), isNull(users.deletedAt), notFrozen()));

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

/* ------------------------------------------------------------------ */
/* Waiting for signed copies (D-291)                                   */
/* ------------------------------------------------------------------ */

export type AwaitingUpload = {
  userId: string;
  userName: string;
  /** The prepared documents with no signed copy under review or verified. */
  documents: { id: string; label: string; rejected: boolean }[];
  /** When a reminder was last queued for this person, if ever. */
  lastReminderAt: Date | null;
};

const REMINDER_KIND = "contributor_upload_reminder";

function documentLabel(kind: ContributorDocumentKind, articleTitle: string | null): string {
  return articleTitle ? `${DOCUMENT_KIND_LABELS[kind]} — ${articleTitle}` : DOCUMENT_KIND_LABELS[kind];
}

/**
 * Everyone who was sent a prepared document and has not uploaded its signed
 * copy, or whose upload was rejected. A copy under review or verified counts
 * as uploaded.
 * A frozen writer is left out (D-299).
 */
export async function listAwaitingUploads(actor: Actor): Promise<AwaitingUpload[]> {
  if (!canManageAgreements(actor)) throw forbidden();

  const rows = await db
    .select({
      id: contributorDocuments.id,
      kind: contributorDocuments.kind,
      userId: users.id,
      userName: users.displayName,
      email: users.email,
      articleTitle: workTitle,
    })
    .from(contributorDocuments)
    .innerJoin(users, eq(contributorDocuments.userId, users.id))
    .leftJoin(articles, eq(contributorDocuments.articleId, articles.id))
    .leftJoin(issueQuizzes, eq(contributorDocuments.quizId, issueQuizzes.id))
    .where(
      and(
        eq(contributorDocuments.status, "prepared"),
        isNull(users.deletedAt),
        notFrozen(),
      ),
    )
    .orderBy(users.displayName, contributorDocuments.kind, contributorDocuments.createdAt);
  if (rows.length === 0) return [];

  const uploads = await db
    .select({ documentId: signedContracts.contributorDocumentId, status: signedContracts.status })
    .from(signedContracts)
    .where(inArray(signedContracts.contributorDocumentId, rows.map((row) => row.id)))
    .orderBy(desc(signedContracts.uploadedAt));
  // Newest first, so the first status seen per document is its latest
  const latest = new Map<string, string>();
  for (const upload of uploads) if (upload.documentId && !latest.has(upload.documentId)) latest.set(upload.documentId, upload.status);

  const byUser = new Map<string, AwaitingUpload & { email: string }>();
  for (const row of rows) {
    const status = latest.get(row.id);
    if (status === "pending" || status === "approved") continue;
    const entry = byUser.get(row.userId) ?? { userId: row.userId, userName: row.userName, email: row.email, documents: [], lastReminderAt: null };
    entry.documents.push({ id: row.id, label: documentLabel(row.kind, row.articleTitle), rejected: status === "rejected" });
    byUser.set(row.userId, entry);
  }
  if (byUser.size === 0) return [];

  const reminders = await db
    .select({ recipient: mailJobs.recipient, at: sql<Date>`max(${mailJobs.createdAt})` })
    .from(mailJobs)
    .where(and(eq(mailJobs.kind, REMINDER_KIND), inArray(mailJobs.recipient, [...byUser.values()].map((entry) => entry.email))))
    .groupBy(mailJobs.recipient);
  const lastByEmail = new Map(reminders.map((row) => [row.recipient, row.at ? new Date(row.at) : null]));

  return [...byUser.values()].map(({ email, ...entry }) => ({ ...entry, lastReminderAt: lastByEmail.get(email) ?? null }));
}

/**
 * Queues a reminder to each chosen person (or everyone waiting) and stops
 * there (D-291): the admin sends the batch from /admin/mail. Every press queues
 * a reminder (D-298); how often is the admin's call, and the table shows when
 * the last one was queued.
 */
export async function queueUploadReminders(
  actor: Actor,
  userIds: readonly string[] | "all",
  meta: RequestMeta,
): Promise<{ queued: number }> {
  if (!canManageAgreements(actor)) throw forbidden();
  const waiting = (await listAwaitingUploads(actor)).filter((entry) => userIds === "all" || userIds.includes(entry.userId));
  if (waiting.length === 0) return { queued: 0 };

  const people = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, waiting.map((entry) => entry.userId)));
  const emailOf = new Map(people.map((person) => [person.id, person]));

  const mails: OutgoingMail[] = waiting.flatMap((entry) => {
    const person = emailOf.get(entry.userId);
    if (!person) return [];
    const message = templates.contributorUploadReminder({
      displayName: person.displayName,
      documents: entry.documents.map((document) => document.label),
      url: `${env().APP_URL}/account`,
    });
    return [{ to: person.email, ...message }];
  });

  // Stored only: enqueueMails does not start a delivery
  const ids = await enqueueMails(mails);
  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.reminders_queued",
    entityType: "users",
    after: { queued: ids.length, userIds: waiting.map((entry) => entry.userId) },
    ip: meta.ip,
  });
  return { queued: ids.length };
}
