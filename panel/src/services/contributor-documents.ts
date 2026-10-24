/**
 * Documents prepared for the contributors to sign by hand (D-276): the
 * Genel Katkı Sağlayan Sözleşmesi of the current version for every
 * contributor, and an Eser Bazlı Kullanım Ruhsatı Formu for every work, on
 * the account of the work's own author. A work is an article, an issue's
 * quiz whose author the admin has named (D-300), or a work kept in the code
 * such as the manor game (D-359). An author's works in one issue share one
 * form when there are more than one (D-339).
 *
 * Preparing is all this does. Nothing is sent (mail goes out only when an
 * admin asks for it per person, `mailContributorDocuments`, D-285), no
 * work is licensed, and no work, author or status is touched — the records
 * are only read. A value the records do not hold, or hold doubtfully, is not
 * filled in: the document is kept as `needs_review` with the reason.
 *
 * Running it again adds only what is missing. A prepared document is never
 * rewritten (someone may already have signed its PDF); a document waiting for
 * review is tried again, in place, so fixing the data resolves it. A licence
 * form drawn from an earlier template that nobody holds yet (not mailed, not
 * queued, no signed copy) is deleted and drawn again from the current one
 * (D-340); one its owner holds stays as it was.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, desc, eq, gte, inArray, isNull, like, lte, ne, not, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  agreementVersions,
  articles,
  auditLog,
  contributorDocuments,
  contributorDocumentWorks,
  issueQuizzes,
  issues,
  mailJobs,
  rightsGrants,
  signedContracts,
  siteSettings,
  users,
  writerApplications,
  type AgreementVersion,
  type ContributorDocument,
  type MailJob,
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
  LICENCE_COMMERCIAL_SETTING,
  LICENCE_FORM_FILE,
  LICENCE_FORM_TEMPLATE_VERSION,
  LICENCE_GROUP_FORM_FILE,
  LICENCE_GROUP_TEMPLATE_VERSION,
  licenceFormValues,
  reasonForPlaceholder,
  wordCount,
  type ContributorDocumentKind,
  type LicenceTerms,
} from "@/lib/contributor-documents";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { parseOutcomes, parseQuestions, quizWorkText } from "@/lib/issue-quiz";
import { CODE_WORKS, codeWorkByKey, type CodeWork } from "@/lib/code-works";
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

/** Whether new licence forms include commercial use (D-340); "Hariç" until an admin says so. */
export async function licenceCommercialUse(): Promise<boolean> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, LICENCE_COMMERCIAL_SETTING))
    .limit(1);
  return row?.value === "included";
}

/** The fixed licence scope, with the admin's commercial-use choice (D-340). */
async function currentLicenceTerms(): Promise<LicenceTerms> {
  return { ...LICENCE_TERMS, commercialUseIncluded: await licenceCommercialUse() };
}

/**
 * The admin sets whether forms prepared from now on include commercial use
 * (D-340). Forms already prepared keep the text they were drawn with.
 */
export async function setLicenceCommercialUse(actor: Actor, included: boolean, meta: RequestMeta): Promise<void> {
  if (!canManageAgreements(actor)) throw forbidden();
  const before = await licenceCommercialUse();
  const value = included ? "included" : "excluded";
  await db
    .insert(siteSettings)
    .values({ key: LICENCE_COMMERCIAL_SETTING, value, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value, updatedBy: actor.id, updatedAt: new Date() },
    });
  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.commercial_use_set",
    entityType: "site_settings",
    entityId: null,
    before: { commercialUseIncluded: before },
    after: { commercialUseIncluded: included },
    ip: meta.ip,
  });
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
  /** Unsent forms from an earlier licence template, deleted to be drawn again (D-340). */
  redrawn: number;
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

function codeWork(entry: CodeWork): LicensedWork {
  return {
    id: entry.key,
    title: entry.title,
    body: readFileSync(path.join(process.cwd(), entry.file), "utf8"),
    typeLabel: entry.typeLabel,
    describe: (words) => `Dergi sitesinde yayımlanan metin (${entry.file}), ${words} kelime`,
  };
}

/** The work a licence document is for, as it stands now; null when it is gone. */
async function workOf(row: ContributorDocument): Promise<LicensedWork | null> {
  if (row.workKey) {
    const entry = codeWorkByKey(row.workKey);
    return entry ? codeWork(entry) : null;
  }
  if (row.quizId) {
    const [quiz] = await db.select().from(issueQuizzes).where(eq(issueQuizzes.id, row.quizId)).limit(1);
    return quiz ? quizWork(quiz) : null;
  }
  const [article] = row.articleId ? await db.select().from(articles).where(eq(articles.id, row.articleId)).limit(1) : [];
  return article ? articleWork(article) : null;
}

/** The works an issue form names, as they stand now, in the form's order (D-339). */
async function groupWorksOf(documentId: string): Promise<GroupWork[]> {
  const rows = await db
    .select({ article: articles, quiz: issueQuizzes, workKey: contributorDocumentWorks.workKey })
    .from(contributorDocumentWorks)
    .leftJoin(articles, eq(contributorDocumentWorks.articleId, articles.id))
    .leftJoin(issueQuizzes, eq(contributorDocumentWorks.quizId, issueQuizzes.id))
    .where(eq(contributorDocumentWorks.documentId, documentId))
    .orderBy(contributorDocumentWorks.position);
  const works: GroupWork[] = [];
  for (const { article, quiz, workKey } of rows) {
    const entry = workKey ? codeWorkByKey(workKey) : undefined;
    if (entry) {
      works.push({ ...codeWork(entry), articleId: null, quizId: null, workKey: entry.key, bylineChoice: null });
    } else if (quiz) {
      works.push({ ...quizWork(quiz), articleId: null, quizId: quiz.id, workKey: null, bylineChoice: null });
    } else if (article) {
      const [grant] = await db
        .select({ bylineChoice: rightsGrants.bylineChoice })
        .from(rightsGrants)
        .where(and(eq(rightsGrants.articleId, article.id), eq(rightsGrants.status, "signed")))
        .orderBy(desc(rightsGrants.signedAt))
        .limit(1);
      works.push({ ...articleWork(article), articleId: article.id, quizId: null, workKey: null, bylineChoice: grant?.bylineChoice ?? null });
    }
  }
  return works;
}

/** The title a list shows for a document's work, article or quiz, or an issue form's works (D-339). */
const workTitle = sql<string | null>`coalesce(${articles.title}, ${issueQuizzes.title}, ${contributorDocuments.worksLabel})`;

/** The licence form for one work, filled from the work and its author's records. */
async function draftLicence(
  version: AgreementVersion,
  terms: LicenceTerms,
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

  const { values, words, contentHash } = await licenceValues(version, terms, work, author, bylineChoice, formId, now);
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
  terms: LicenceTerms,
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
      terms,
      bylineChoice,
      displayName: escapeForTemplate(author.displayName),
      penName: author.penName ? escapeForTemplate(author.penName) : null,
    }),
    // Filled after the fact: the hash covers the text with this field unfilled
    "form.text_hash": "{{form.text_hash}}",
  };
  return { values, words, contentHash };
}

/** One work of an issue form (D-339), with the byline its author chose for it. */
type GroupWork = LicensedWork & {
  articleId: string | null;
  quizId: string | null;
  workKey: string | null;
  bylineChoice: "real_name" | "pen_name" | null;
};

/** What the lists call an issue form: the issue and its works' titles. */
function groupLabel(issueNumber: number, works: readonly GroupWork[]): string {
  return `Sayı ${issueNumber}: ${works.map((work) => work.title.trim() || "(başlıksız)").join("; ")}`;
}

/**
 * The issue form's values (D-339): section 1 lists every work with the facts
 * the single form gives one, and its own byline. A fact a work lacks is a
 * reason for review; `gap` marks it in place for the admin's preview.
 */
async function groupLicenceValues(
  version: AgreementVersion,
  terms: LicenceTerms,
  works: readonly GroupWork[],
  author: User,
  issueNumber: number | null,
  formId: string,
  now: Date,
  gap: ((reason: string) => string) | null,
) {
  const reasons: string[] = [];
  const contentHashes: (string | null)[] = [];
  const missing = (reason: string) => {
    reasons.push(reason);
    return gap ? gap(reason) : "";
  };

  const entries = works.map((work, index) => {
    const words = wordCount(work.body);
    const contentHash = work.body.trim() ? articleHash(work.body) : null;
    contentHashes.push(contentHash);
    const byline = licenceFormValues({
      terms,
      bylineChoice: work.bylineChoice,
      displayName: escapeForTemplate(author.displayName),
      penName: author.penName ? escapeForTemplate(author.penName) : null,
    })["form.byline_label"];
    return [
      `### Eser ${index + 1}`,
      `Başlık\n${work.title.trim() ? escapeForTemplate(work.title) : missing("Eser başlığı boş")}`,
      `Tür\n${work.typeLabel}`,
      `Eser tanımı / teknik bilgi\n${words > 0 ? work.describe(words) : missing("Eser metni boş")}`,
      `Ruhsata konu dosya/metin özeti (SHA-256)\n${contentHash ?? missing("Eser metni boş")}`,
      `Panel kaydı\n${work.id}`,
      `Yayın adı\n${byline ?? missing(reasonForPlaceholder("form.byline_label"))}`,
    ].join("\n\n");
  });

  const context = await buildAgreementContext(version, { ...author, contributionRole: "Yazar" });
  const values: Record<string, string | null> = {
    ...buildPlaceholders(context),
    ...licenceFormValues({
      terms,
      bylineChoice: null,
      displayName: escapeForTemplate(author.displayName),
      penName: author.penName ? escapeForTemplate(author.penName) : null,
    }),
    "sayi.ad": issueNumber === null ? null : `Sayı ${issueNumber}`,
    "eserler.sayisi": String(works.length),
    "eserler.liste": entries.join("\n\n"),
    "form.id": formId,
    "form.template_version": LICENCE_GROUP_TEMPLATE_VERSION,
    "form.created_at": formatContractDate(now),
    // Filled after the fact: the hash covers the text with this field unfilled
    "form.text_hash": "{{form.text_hash}}",
  };
  return { values, reasons: [...new Set(reasons)], contentHashes };
}

/** The issue form for an author's works in one issue (D-339). */
async function draftGroupLicence(
  version: AgreementVersion,
  terms: LicenceTerms,
  works: readonly GroupWork[],
  author: User,
  issueNumber: number | null,
  formId: string,
  now: Date,
  versionReason: string | null,
): Promise<Draft & { contentHashes: (string | null)[] }> {
  const { values, reasons, contentHashes } = await groupLicenceValues(version, terms, works, author, issueNumber, formId, now, null);
  if (versionReason) reasons.unshift(versionReason);

  let rendered: { markdown: string; hash: string } | null = null;
  try {
    const filled = fillTemplate(readContract(LICENCE_GROUP_FORM_FILE), values);
    const hash = hashDocument(filled.markdown);
    rendered = { markdown: filled.markdown.replace("{{form.text_hash}}", hash), hash };
  } catch (error) {
    reasons.push(...reasonsOf(error));
  }
  return { ...draft([...new Set(reasons)], rendered), contentHashes };
}

/** Which works to prepare licence forms for; everything when left out. */
export type LicenceScope = { issueId?: string; userId?: string };

/**
 * Prepares every missing document. Admin only; sends nothing. With a scope,
 * only the licence forms of that issue's (or that person's) works, and the
 * contracts of their authors (D-339).
 */
export async function prepareContributorDocuments(
  actor: Actor,
  meta: RequestMeta,
  scope: LicenceScope = {},
): Promise<PreparationSummary> {
  if (!canManageAgreements(actor)) throw forbidden();
  if ((scope.issueId && !UUID.test(scope.issueId)) || (scope.userId && !UUID.test(scope.userId))) {
    throw notFound("Sayı ya da kişi bulunamadı.");
  }
  const scoped = Boolean(scope.issueId || scope.userId);

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
    redrawn: 0,
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
  const works = await db
    .select()
    .from(articles)
    .where(
      and(
        isNull(articles.deletedAt),
        scope.issueId ? eq(articles.issueId, scope.issueId) : undefined,
        scope.userId ? eq(articles.authorId, scope.userId) : undefined,
      ),
    )
    // An issue form lists the works in the order they were begun
    .orderBy(articles.createdAt, articles.id);
  // Quizzes count as works once the admin has said who wrote them (D-300)
  const quizzes = (
    await db
      .select({ quiz: issueQuizzes })
      .from(issueQuizzes)
      .innerJoin(issues, eq(issueQuizzes.issueId, issues.id))
      .where(
        and(
          isNull(issues.deletedAt),
          scope.issueId ? eq(issueQuizzes.issueId, scope.issueId) : undefined,
          scope.userId ? eq(issueQuizzes.authorId, scope.userId) : undefined,
        ),
      )
      .orderBy(issueQuizzes.createdAt, issueQuizzes.id)
  ).flatMap(({ quiz }) => (quiz.authorId ? [quiz] : []));
  // Works kept in the code, by their issue's number and their author's address (D-359)
  const codeIssues = await db
    .select({ id: issues.id, number: issues.number })
    .from(issues)
    .where(and(isNull(issues.deletedAt), inArray(issues.number, [...new Set(CODE_WORKS.map((work) => work.issueNumber))])));
  const codeAuthors = await db
    .select()
    .from(users)
    .where(inArray(sql`lower(${users.email})`, [...new Set(CODE_WORKS.map((work) => work.authorEmail))]));
  const codeWorks = CODE_WORKS.flatMap((entry) => {
    const issue = codeIssues.find((row) => row.number === entry.issueNumber);
    const author = codeAuthors.find((row) => row.email.trim().toLowerCase() === entry.authorEmail);
    if (!issue || (scope.issueId && scope.issueId !== issue.id) || (scope.userId && scope.userId !== author?.id)) return [];
    return [{ entry, issueId: issue.id, author }];
  });
  const authorIds = new Set([
    ...works.flatMap((work) => (work.authorId ? [work.authorId] : [])),
    ...quizzes.map((quiz) => quiz.authorId!),
    ...codeWorks.flatMap(({ author }) => (author ? [author.id] : [])),
  ]);

  /* ---- Contributors: writers, çizerler, and anyone who wrote a work ---- */
  // A scoped run is about the works in scope: only their authors' contracts
  const people = await db
    .select()
    .from(users)
    .where(
      or(
        scoped ? undefined : eq(users.role, "writer"),
        scoped ? undefined : eq(users.isIllustrator, true),
        authorIds.size ? inArray(users.id, [...authorIds]) : sql`false`,
      ),
    );
  const byId = new Map(people.map((person) => [person.id, person]));

  const terms = await currentLicenceTerms();
  let existing = await db.select().from(contributorDocuments);

  // A form from an earlier licence template that nobody holds yet is drawn
  // again from the current one (D-340); only for works in this run's scope
  const free = new Set(
    (
      await db
        .select({ id: contributorDocuments.id })
        .from(contributorDocuments)
        .where(and(eq(contributorDocuments.kind, "work_licence"), withoutSignedCopy, notMailed))
    ).map((row) => row.id),
  );
  const inScope = new Set([
    ...works.map((work) => work.id),
    ...quizzes.map((quiz) => quiz.id),
    ...codeWorks.map(({ entry }) => entry.key),
  ]);
  const formWorks = await db
    .select({
      documentId: contributorDocumentWorks.documentId,
      articleId: contributorDocumentWorks.articleId,
      quizId: contributorDocumentWorks.quizId,
      workKey: contributorDocumentWorks.workKey,
    })
    .from(contributorDocumentWorks);
  const outdated = existing
    .filter(
      (row) =>
        row.kind === "work_licence" &&
        row.templateVersion !== (row.issueId ? LICENCE_GROUP_TEMPLATE_VERSION : LICENCE_FORM_TEMPLATE_VERSION) &&
        free.has(row.id) &&
        (inScope.has(row.articleId ?? row.quizId ?? row.workKey ?? "") ||
          formWorks.some(
            (work) => work.documentId === row.id && inScope.has(work.articleId ?? work.quizId ?? work.workKey ?? ""),
          )),
    )
    .map((row) => row.id);
  if (outdated.length) {
    // The same guard again in the statement: a mail queued since is kept
    const removed = await db
      .delete(contributorDocuments)
      .where(and(inArray(contributorDocuments.id, outdated), withoutSignedCopy, notMailed))
      .returning({ id: contributorDocuments.id });
    summary.redrawn = removed.length;
    const gone = new Set(removed.map((row) => row.id));
    existing = existing.filter((row) => !gone.has(row.id));
  }

  const generalOf = new Map(
    existing
      .filter((row) => row.kind === "general_agreement" && row.agreementVersionId === version.id)
      .map((row) => [row.userId, row]),
  );
  const licenceOf = new Map(
    existing
      .filter((row) => row.kind === "work_licence" && !row.issueId && row.articleId)
      .map((row) => [row.articleId, row]),
  );
  const quizLicenceOf = new Map(
    existing
      .filter((row) => row.kind === "work_licence" && !row.issueId && row.quizId)
      .map((row) => [row.quizId, row]),
  );
  const codeLicenceOf = new Map(
    existing
      .filter((row) => row.kind === "work_licence" && !row.issueId && row.workKey)
      .map((row) => [row.workKey, row]),
  );

  const save = async (
    kind: ContributorDocumentKind,
    current: ContributorDocument | undefined,
    values: {
      userId: string;
      articleId: string | null;
      quizId?: string | null;
      workKey?: string | null;
      /** A code work's title, for the lists (D-359). */
      worksLabel?: string | null;
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
      templateVersion: values.templateVersion,
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
        workKey: values.workKey ?? null,
        worksLabel: values.worksLabel ?? null,
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

  /* ---- Licence forms: one per work, or one per author and issue (D-339) ---- */
  type Candidate = { work: GroupWork; author: User; issueId: string };
  const candidates: Candidate[] = [];
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
    const bylineChoice = bylineOf.get(work.id) ?? null;
    candidates.push({ work: { ...articleWork(work), articleId: work.id, quizId: null, workKey: null, bylineChoice }, author, issueId: work.issueId });
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
    // A quiz carries no byline choice: the form names its author (D-284)
    candidates.push({ work: { ...quizWork(quiz), articleId: null, quizId: quiz.id, workKey: null, bylineChoice: null }, author, issueId: quiz.issueId });
  }
  for (const { entry, issueId, author } of codeWorks) {
    if (!author || author.deletedAt) {
      skip("Kodda tanımlı eserin yazarının hesabı bulunamadı: ruhsat hazırlanmadı");
      continue;
    }
    if (!needsAuthorAgreement(author)) {
      skip(ADMIN_SKIP);
      continue;
    }
    // Like a quiz, it carries no byline choice: the form names its author (D-284)
    candidates.push({ work: { ...codeWork(entry), articleId: null, quizId: null, workKey: entry.key, bylineChoice: null }, author, issueId });
  }

  // A work an issue form names is on that form, whatever the form's state
  const grouped = await db
    .select({
      documentId: contributorDocumentWorks.documentId,
      articleId: contributorDocumentWorks.articleId,
      quizId: contributorDocumentWorks.quizId,
      workKey: contributorDocumentWorks.workKey,
    })
    .from(contributorDocumentWorks)
    .orderBy(contributorDocumentWorks.position);
  const onGroup = new Set(
    grouped.flatMap((row) => [row.articleId, row.quizId, row.workKey]).filter((id): id is string => Boolean(id)),
  );
  // A single form nobody holds yet (`free` above: not mailed, not queued, no
  // signed copy) gives way to the issue form; one its owner holds keeps its work (D-314)
  const singleOf = (work: GroupWork) =>
    work.workKey
      ? codeLicenceOf.get(work.workKey)
      : work.quizId
        ? quizLicenceOf.get(work.quizId)
        : licenceOf.get(work.articleId);
  const issueForms = existing.filter(
    (row) => row.kind === "work_licence" && row.issueId,
  );

  const byKey = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.author.id}:${candidate.issueId}`;
    byKey.set(key, [...(byKey.get(key) ?? []), candidate]);
  }
  const issueRows = byKey.size
    ? await db
        .select({ id: issues.id, number: issues.number })
        .from(issues)
        .where(inArray(issues.id, [...new Set(candidates.map((candidate) => candidate.issueId))]))
    : [];
  const issueNumber = new Map(issueRows.map((row) => [row.id, row.number]));

  /** The single form of one work, as before D-339. */
  const saveSingle = async ({ work, author }: Candidate) => {
    const current = singleOf(work);
    if (current?.status === "prepared") {
      summary.alreadyPrepared.licence += 1;
      return;
    }
    const formId = current?.id ?? randomUUID();
    const result = await draftLicence(version, terms, work, author, work.bylineChoice, formId, now, versionReason);
    await save(
      "work_licence",
      current,
      {
        id: formId,
        userId: author.id,
        articleId: work.articleId,
        quizId: work.quizId,
        workKey: work.workKey,
        worksLabel: work.workKey ? work.title : null,
        templateVersion: LICENCE_FORM_TEMPLATE_VERSION,
        contentHash: result.contentHash,
      },
      result,
    );
  };

  for (const [key, group] of byKey) {
    const [userId, issueId] = key.split(":") as [string, string];
    const author = group[0]!.author;
    const forms = issueForms.filter((row) => row.userId === userId && row.issueId === issueId);
    summary.alreadyPrepared.licence += forms.filter((row) => row.status === "prepared").length;
    // A work whose single form its owner already holds stays on that form
    const held = group.filter(({ work }) => {
      const single = singleOf(work);
      return single !== undefined && !free.has(single.id);
    });
    for (const candidate of held) await saveSingle(candidate);
    const open = group.filter((candidate) => !held.includes(candidate) && !onGroup.has(candidate.work.id));

    // An issue form under review takes the new works in and is drawn again;
    // a prepared one is never rewritten (someone may have signed its PDF)
    const review = forms.find((row) => row.status === "needs_review");
    // Its works keep their places; the new ones follow
    const reviewWorks = review
      ? grouped
          .filter((row) => row.documentId === review.id)
          .flatMap((row) => group.filter(({ work }) => work.id === (row.articleId ?? row.quizId ?? row.workKey)))
      : [];
    if (!review && open.length < 2) {
      // One work alone keeps the single form
      for (const candidate of open) await saveSingle(candidate);
      continue;
    }
    const members = [...reviewWorks, ...open].map(({ work }) => work);
    if (members.length === 0) continue;

    const formId = review?.id ?? randomUUID();
    const number = issueNumber.get(issueId) ?? null;
    const result = await draftGroupLicence(version, terms, members, author, number, formId, now, versionReason);
    count(result);
    const fields = {
      status: result.status,
      reviewReasons: result.reasons,
      renderedMarkdown: result.markdown,
      textHash: result.hash,
      worksLabel: number === null ? null : groupLabel(number, members),
      templateVersion: LICENCE_GROUP_TEMPLATE_VERSION,
      updatedAt: now,
    };
    const replaced = members.flatMap((work) => {
      const single = singleOf(work);
      return single && free.has(single.id) ? [single.id] : [];
    });
    await db.transaction(async (tx) => {
      // The single drafts the issue form replaces: still unsent and unsigned
      if (replaced.length) {
        await tx.delete(contributorDocuments).where(and(inArray(contributorDocuments.id, replaced), withoutSignedCopy, notMailed));
      }
      if (review) {
        await tx
          .update(contributorDocuments)
          .set(fields)
          .where(and(eq(contributorDocuments.id, review.id), eq(contributorDocuments.status, "needs_review")));
        await tx.delete(contributorDocumentWorks).where(eq(contributorDocumentWorks.documentId, review.id));
      } else {
        await tx.insert(contributorDocuments).values({
          id: formId,
          kind: "work_licence",
          userId: author.id,
          agreementVersionId: version.id,
          issueId,
          createdBy: actor.id,
          ...fields,
        });
      }
      await tx.insert(contributorDocumentWorks).values(
        members.map((work, index) => ({
          documentId: formId,
          position: index + 1,
          articleId: work.articleId,
          quizId: work.quizId,
          workKey: work.workKey,
          contentHash: result.contentHashes[index] ?? null,
        })),
      );
    });
    if (!review) summary.licenceCreated += 1;
    else if (result.status === "prepared") summary.resolved += 1;
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
      redrawn: summary.redrawn,
      ...(scoped ? { scope } : {}),
    },
    ip: meta.ip,
  });
  return summary;
}

/**
 * Deletes the prepared documents so they can be prepared again from the
 * current templates (D-281). Only drafts go: a document that was mailed, or is
 * waiting in the outbox, stays (D-314), and a signed copy lives in
 * `signed_contracts`, which this does not touch.
 */
/** No signed copy was uploaded for the document; only such a document may be deleted. */
export const withoutSignedCopy = sql`not exists (select 1 from ${signedContracts} where ${signedContracts.contributorDocumentId} = ${contributorDocuments.id})`;

/**
 * Not delivered and not waiting in the outbox (D-314): the only documents that
 * may be queued, sent or cleared. A failed mail counts as not sent.
 */
export const notMailed = sql`${contributorDocuments.mailedAt} is null and not exists (select 1 from ${mailJobs} where ${mailJobs.id} = ${contributorDocuments.mailJobId} and ${mailJobs.status} <> 'failed')`;

export async function clearContributorDocuments(actor: Actor, meta: RequestMeta): Promise<number> {
  if (!canManageAgreements(actor)) throw forbidden();
  await syncDocumentMails();
  // A document someone has uploaded a signed copy of stays (D-289), and so
  // does one that was mailed: it is what its owner holds (D-314)
  const removed = await db
    .delete(contributorDocuments)
    .where(and(withoutSignedCopy, notMailed))
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

/** Where a document's mail stands (D-314). */
export type DocumentMailState = "sent" | "queued" | "failed" | "not_sent";

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
  userIsMainEditor: boolean;
  userIsIllustrator: boolean;
  articleId: string | null;
  articleTitle: string | null;
  articleStatus: string | null;
  mailState: DocumentMailState;
  /** When its mail was delivered; null until then. */
  mailedAt: Date | null;
  /** A signed copy was uploaded for it: "delete all" leaves it alone. */
  hasSignedCopy: boolean;
  /** Its owner can be sent a bulk mail: not deleted, not frozen, not an admin (D-299, D-305). */
  ownerReachable: boolean;
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
      userIsMainEditor: owners.isMainEditor,
      userIsIllustrator: owners.isIllustrator,
      articleId: articles.id,
      // A quiz's licence shows the quiz's title in the same column (D-300)
      articleTitle: workTitle,
      articleStatus: articles.status,
      mailState: sql<DocumentMailState>`case
        when ${contributorDocuments.mailedAt} is not null or ${mailJobs.status} = 'sent' then 'sent'
        when ${mailJobs.status} in ('pending', 'processing') then 'queued'
        when ${mailJobs.status} = 'failed' then 'failed'
        else 'not_sent' end`,
      mailedAt: contributorDocuments.mailedAt,
      hasSignedCopy: sql<boolean>`exists (select 1 from ${signedContracts} where ${signedContracts.contributorDocumentId} = ${contributorDocuments.id})`,
      ownerReachable: sql<boolean>`(${owners.deletedAt} is null and (${owners.writerStatus} is null or ${owners.writerStatus} <> 'suspended') and ${owners.role} <> 'admin')`,
    })
    .from(contributorDocuments)
    .innerJoin(owners, eq(contributorDocuments.userId, owners.id))
    .leftJoin(mailJobs, eq(contributorDocuments.mailJobId, mailJobs.id))
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
  await syncDocumentMails();
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
    const coded = CODE_WORKS.some((work) => work.authorEmail === owner!.email.trim().toLowerCase());
    const values = await generalValues(version, owner!, Boolean(authored ?? quizzed) || coded);
    return { ...base, markdown: previewTemplate(version.bodyMarkdown, values, OPTIONAL, gap).markdown, isPreview: true, unavailable: null };
  }

  if (row.issueId) {
    const works = await groupWorksOf(row.id);
    if (works.length === 0) return { ...base, markdown: null, isPreview: true, unavailable: "Belgenin eserleri artık kayıtlı değil." };
    const [issue] = await db.select({ number: issues.number }).from(issues).where(eq(issues.id, row.issueId)).limit(1);
    const { values } = await groupLicenceValues(version, await currentLicenceTerms(), works, owner!, issue?.number ?? null, row.id, row.updatedAt, (reason) => `**[EKSİK: ${reason}]**`);
    values["form.text_hash"] = "(belge hazır olunca hesaplanır)";
    return {
      ...base,
      markdown: previewTemplate(readContract(LICENCE_GROUP_FORM_FILE), values, new Set(), gap).markdown,
      isPreview: true,
      unavailable: null,
    };
  }

  const work = await workOf(row);
  if (!work) return { ...base, markdown: null, isPreview: true, unavailable: "Belgenin eseri artık kayıtlı değil." };
  const [grant] = await db
    .select({ bylineChoice: rightsGrants.bylineChoice })
    .from(rightsGrants)
    .where(and(eq(rightsGrants.articleId, row.articleId ?? row.id), eq(rightsGrants.status, "signed")))
    .orderBy(desc(rightsGrants.signedAt))
    .limit(1);
  const { values } = await licenceValues(version, await currentLicenceTerms(), work, owner!, grant?.bylineChoice ?? null, row.id, row.updatedAt);
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
    // Every wet-signed page is initialled by both sides (D-358)
    initialsLine: "Paraf — Katkı Sağlayan: ______________      PostScript Dergisi: ______________",
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

/**
 * Someone the magazine still works with (D-322): writer and above, a designer,
 * or an applicant whose approved application waits for its contract. A writer
 * sent back to reader drops off the signing lists; their records stay.
 */
export const stillContributing = () =>
  or(
    ne(users.role, "user"),
    eq(users.isIllustrator, true),
    sql`exists (select 1 from ${writerApplications} where ${writerApplications.userId} = ${users.id} and ${writerApplications.status} = 'admin_approved')`,
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
 * press adds only people whose documents changed. A document already mailed,
 * or waiting in the outbox, is left out: only what was not sent goes (D-314).
 */
export async function queueAllContributorDocuments(
  actor: Actor,
  meta: RequestMeta,
): Promise<{ mails: number; documents: number; alreadyQueued: number; failedBefore: number }> {
  if (!canManageAgreements(actor)) throw forbidden();
  await syncDocumentMails();

  // What a person already received is not sent again (D-314)
  const rows = await preparedRows(and(eq(contributorDocuments.status, "prepared"), notMailed)!);
  const byUser = new Map<string, PreparedRow[]>();
  for (const row of rows) byUser.set(row.document.userId, [...(byUser.get(row.document.userId) ?? []), row]);
  if (byUser.size === 0) return { mails: 0, documents: 0, alreadyQueued: 0, failedBefore: 0 };

  const people = await db
    .select()
    .from(users)
    .where(and(inArray(users.id, [...byUser.keys()]), isNull(users.deletedAt), notFrozen()));

  let queued = 0;
  let alreadyQueued = 0;
  let failedBefore = 0;
  let documents = 0;
  for (const person of people) {
    const own = byUser.get(person.id)!;
    const mail: OutgoingMail = {
      ...(await documentsMail(person, own)),
      dedupeKey: `contributor_documents:${person.id}:${documentSetKey(own.map(({ document }) => document))}`,
    };
    // Stored only: enqueueMails does not start a delivery. One person at a
    // time, so each job can be written onto the documents it carries
    const [jobId] = await enqueueMails([mail]);
    if (!jobId) {
      // The same set was queued before. If that mail failed, the outbox will
      // not take it again under the same key: it is retried from /admin/mail
      const [earlier] = await db
        .select({ id: mailJobs.id, status: mailJobs.status })
        .from(mailJobs)
        .where(eq(mailJobs.dedupeKey, mail.dedupeKey!))
        .limit(1);
      if (earlier?.status === "failed") {
        failedBefore += 1;
        await db
          .update(contributorDocuments)
          .set({ mailJobId: earlier.id })
          .where(inArray(contributorDocuments.id, own.map(({ document }) => document.id)));
      } else {
        alreadyQueued += 1;
      }
      continue;
    }
    queued += 1;
    documents += own.length;
    await db
      .update(contributorDocuments)
      .set({ mailJobId: jobId })
      .where(inArray(contributorDocuments.id, own.map(({ document }) => document.id)));
  }
  await writeAudit({
    actorId: actor.id,
    action: "contributor_documents.queued",
    entityType: "contributor_documents",
    after: { mails: queued, alreadyQueued, failedBefore, documents },
    ip: meta.ip,
  });
  return { mails: queued, documents, alreadyQueued, failedBefore };
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

  await syncDocumentMails();
  const ready = await preparedRows(and(eq(contributorDocuments.userId, userId), eq(contributorDocuments.status, "prepared"))!);
  if (ready.length === 0) throw conflict("Bu kullanıcının hazır belgesi yok; incelemedeki belgeler gönderilmez.");
  // What they already received, or what is waiting in the outbox, is not sent again (D-314)
  const rows = await preparedRows(
    and(eq(contributorDocuments.userId, userId), eq(contributorDocuments.status, "prepared"), notMailed)!,
  );
  if (rows.length === 0) throw conflict("Bu kullanıcının hazır belgeleri zaten gönderildi ya da e-posta kuyruğunda.");

  const jobId = await sendMail(await documentsMail(person, rows));
  if (jobId) {
    await db
      .update(contributorDocuments)
      .set({ mailJobId: jobId })
      .where(inArray(contributorDocuments.id, rows.map(({ document }) => document.id)));
  }

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

/** The outbox's dedupe key for one person's set of documents (D-286). */
function documentSetKey(documents: Pick<ContributorDocument, "id" | "textHash">[]): string {
  return hashDocument(documents.map((document) => `${document.id}:${document.textHash}`).join("|"));
}

/** How far around an audited send its outbox job may have been written. */
const SEND_WINDOW_MS = 5 * 60 * 1000;

/**
 * Brings the documents' mail state in line with the outbox (D-314). Safe to
 * run any number of times; the admin's document actions run it first.
 *
 *  1. a delivery the outbox recorded is written onto its documents, should
 *     the queue's own write have been missed;
 *  2. mails queued in bulk before documents carried their job are matched by
 *     the outbox's own dedupe key: the same person's same set of documents;
 *  3. mails sent to one person before then are matched by the audit record
 *     that names their documents, and the outbox job written with it.
 *
 * A mail that cannot be matched is left alone: the document then shows as not
 * sent, and the outbox's dedupe key still refuses the same set a second time.
 */
async function syncDocumentMails(): Promise<void> {
  const delivered = await db
    .selectDistinct({ jobId: mailJobs.id, sentAt: mailJobs.sentAt })
    .from(contributorDocuments)
    .innerJoin(mailJobs, eq(contributorDocuments.mailJobId, mailJobs.id))
    .where(and(isNull(contributorDocuments.mailedAt), eq(mailJobs.status, "sent")));
  for (const job of delivered) {
    await db
      .update(contributorDocuments)
      .set({ mailedAt: job.sentAt ?? new Date() })
      .where(and(eq(contributorDocuments.mailJobId, job.jobId), isNull(contributorDocuments.mailedAt)));
  }

  const link = async (job: Pick<MailJob, "id" | "status" | "sentAt" | "createdAt">, documentIds: string[]) => {
    if (documentIds.length === 0) return;
    await db
      .update(contributorDocuments)
      .set({ mailJobId: job.id, mailedAt: job.status === "sent" ? (job.sentAt ?? job.createdAt) : null })
      .where(
        and(
          inArray(contributorDocuments.id, documentIds),
          isNull(contributorDocuments.mailJobId),
          isNull(contributorDocuments.mailedAt),
        ),
      );
  };
  const unclaimed = sql`not exists (select 1 from ${contributorDocuments} where ${contributorDocuments.mailJobId} = ${mailJobs.id})`;

  // Steps 2 and 3 can only link a document no mail is linked to yet. Asked
  // first, so the usual load, where every sent document already carries its
  // job, stops here instead of reading the outbox and the whole audit trail
  // once per page view (D-368).
  const unlinked = await db
    .select({ id: contributorDocuments.id, userId: contributorDocuments.userId })
    .from(contributorDocuments)
    .where(and(isNull(contributorDocuments.mailJobId), isNull(contributorDocuments.mailedAt)));
  if (unlinked.length === 0) return;
  const unlinkedIds = new Set(unlinked.map((row) => row.id));
  const ownerIds = [...new Set(unlinked.map((row) => row.userId))];

  const bulk = await db
    .select({
      id: mailJobs.id,
      status: mailJobs.status,
      sentAt: mailJobs.sentAt,
      createdAt: mailJobs.createdAt,
      dedupeKey: mailJobs.dedupeKey,
    })
    .from(mailJobs)
    .where(and(eq(mailJobs.kind, "contributor_documents"), like(mailJobs.dedupeKey, "contributor_documents:%"), unclaimed));
  for (const job of bulk) {
    const [, userId, key] = job.dedupeKey!.split(":");
    if (!userId || !key || !UUID.test(userId) || !ownerIds.includes(userId)) continue;
    const candidates = await db
      .select()
      .from(contributorDocuments)
      .where(
        and(
          eq(contributorDocuments.userId, userId),
          eq(contributorDocuments.status, "prepared"),
          lte(contributorDocuments.createdAt, job.createdAt),
          isNull(contributorDocuments.mailJobId),
        ),
      )
      .orderBy(contributorDocuments.kind, contributorDocuments.createdAt);
    // The set as it stood when the mail was queued: made before it, and
    // either already prepared then or prepared since
    const sets = [candidates, candidates.filter((row) => row.updatedAt <= job.createdAt)];
    const match = sets.find((set) => set.length > 0 && documentSetKey(set) === key);
    if (match) await link(job, match.map((row) => row.id));
  }

  // By the owners, through the audit trail's entity index, not by the action alone
  const single = await db
    .select({ at: auditLog.createdAt, userId: auditLog.entityId, after: auditLog.after, email: users.email })
    .from(auditLog)
    .innerJoin(users, eq(auditLog.entityId, users.id))
    .where(
      and(
        eq(auditLog.entityType, "users"),
        inArray(auditLog.entityId, ownerIds),
        eq(auditLog.action, "contributor_documents.mailed"),
      ),
    );
  for (const sent of single) {
    const ids = (sent.after as { documentIds?: unknown } | null)?.documentIds;
    if (!Array.isArray(ids) || ids.length === 0) continue;
    const named = ids.filter((id): id is string => typeof id === "string" && UUID.test(id));
    // A send whose documents are all linked already has nothing left to match
    if (!named.some((id) => unlinkedIds.has(id))) continue;
    const [job] = await db
      .select({ id: mailJobs.id, status: mailJobs.status, sentAt: mailJobs.sentAt, createdAt: mailJobs.createdAt })
      .from(mailJobs)
      .where(
        and(
          eq(mailJobs.kind, "contributor_documents"),
          eq(mailJobs.recipient, sent.email),
          isNull(mailJobs.dedupeKey),
          gte(mailJobs.createdAt, new Date(sent.at.getTime() - SEND_WINDOW_MS)),
          lte(mailJobs.createdAt, new Date(sent.at.getTime() + SEND_WINDOW_MS)),
          unclaimed,
        ),
      )
      .orderBy(mailJobs.createdAt)
      .limit(1);
    if (job) await link(job, named);
  }
}

/* ------------------------------------------------------------------ */
/* Waiting for signed copies (D-291)                                   */
/* ------------------------------------------------------------------ */

export type AwaitingUpload = {
  userId: string;
  userName: string;
  /**
   * The prepared documents with no verified signed copy. One under review is
   * left out, except in the former contributors' list, where it is marked.
   */
  documents: { id: string; label: string; rejected: boolean; pending: boolean }[];
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
 * as uploaded. "Sent" is the document's mail state (D-314): someone whose
 * documents were never mailed is not asked for a signature (D-316).
 * A frozen writer is left out (D-299).
 */
export async function listAwaitingUploads(
  actor: Actor,
  { former = false }: { former?: boolean } = {},
): Promise<AwaitingUpload[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  await syncDocumentMails();

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
        // Those who left are shown apart, so the admin sees what they never signed (D-335)
        former ? not(stillContributing()!) : stillContributing(),
        or(sql`${contributorDocuments.mailedAt} is not null`, not(withoutSignedCopy)),
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
    if (status === "approved" || (status === "pending" && !former)) continue;
    const entry = byUser.get(row.userId) ?? { userId: row.userId, userName: row.userName, email: row.email, documents: [], lastReminderAt: null };
    entry.documents.push({
      id: row.id,
      label: documentLabel(row.kind, row.articleTitle),
      rejected: status === "rejected",
      pending: status === "pending",
    });
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

/* ------------------------------------------------------------------ */
/* Preparing one issue's licence forms (D-339)                         */
/* ------------------------------------------------------------------ */

export type LicenceScopeOptions = {
  issues: { id: string; number: number; title: string }[];
  /** Everyone with a work, who could be asked for a licence form. */
  authors: { id: string; displayName: string; email: string }[];
};

/** What the admin may narrow "prepare licence forms" to. */
export async function listLicenceScopeOptions(actor: Actor): Promise<LicenceScopeOptions> {
  if (!canManageAgreements(actor)) throw forbidden();
  const issueRows = await db
    .select({ id: issues.id, number: issues.number, title: issues.title })
    .from(issues)
    .where(isNull(issues.deletedAt))
    .orderBy(issues.number);
  const authors = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        ne(users.role, "admin"),
        or(
          sql`exists (select 1 from ${articles} where ${articles.authorId} = ${users.id} and ${articles.deletedAt} is null)`,
          sql`exists (select 1 from ${issueQuizzes} where ${issueQuizzes.authorId} = ${users.id})`,
          inArray(sql`lower(${users.email})`, [...new Set(CODE_WORKS.map((work) => work.authorEmail))]),
        ),
      ),
    )
    .orderBy(users.displayName);
  return { issues: issueRows, authors };
}
