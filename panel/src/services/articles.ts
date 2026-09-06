/**
 * Articles: creation, editing, versions, comments and the status transitions
 * (§8 and §9.2).
 *
 * Every status change goes through `transitionArticle`, which asks the pure
 * state machine first and gathers the guard context from the database. There is
 * no other write path for `articles.status`.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articleComments,
  articles,
  articleVersions,
  notifications,
  users,
  type Article,
  type ArticleStatus,
} from "@/db/schema";
import { autoTransitionAfter, checkTransition } from "@/lib/article-status";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, canReadArticle, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { triggerRevalidate } from "@/lib/revalidate";
import { uniqueSlug } from "@/lib/slug";
import * as templates from "@emails/templates";
import { allMediaLicensed } from "./media";
import { createGrantForArticle, declineRightsGrant, findActiveGrant } from "./rights";
import type { RequestMeta } from "./auth";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

export const articleInputSchema = z.strictObject({
  title: z.string().trim().min(3, "Başlık en az 3 karakter olmalı.").max(200),
  summary: z.string().trim().max(600).optional().nullable(),
  bodyMarkdown: z.string().max(200_000).optional(),
  authorId: z.uuid().optional().nullable(),
  coAuthorIds: z.array(z.uuid()).max(10).optional(),
  issueId: z.uuid().optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  changeNote: z.string().trim().max(300).optional().nullable(),
});

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export async function findArticleById(articleId: string): Promise<Article> {
  const rows = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, articleId), isNull(articles.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Makale bulunamadı.");
  return row;
}

export type ArticleFilters = {
  status?: ArticleStatus;
  issueId?: string;
  authorId?: string;
  limit?: number;
  offset?: number;
};

export async function listArticles(actor: Actor, filters: ArticleFilters = {}) {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const conditions: SQL[] = [isNull(articles.deletedAt)];
  if (filters.status) conditions.push(eq(articles.status, filters.status));
  if (filters.issueId) conditions.push(eq(articles.issueId, filters.issueId));
  if (filters.authorId) conditions.push(eq(articles.authorId, filters.authorId));

  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      issueId: articles.issueId,
      authorId: articles.authorId,
      authorName: users.displayName,
      dueDate: articles.dueDate,
      scheduledAt: articles.scheduledAt,
      publishedAt: articles.publishedAt,
      plagiarismCheckStatus: articles.plagiarismCheckStatus,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(articles.updatedAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
}

/** A writer's own assignments, read-only (§9.1). */
export async function listArticlesForWriter(actor: Actor) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      dueDate: articles.dueDate,
      issueId: articles.issueId,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(
      and(
        isNull(articles.deletedAt),
        sql`(${articles.authorId} = ${actor.id} or ${actor.id} = any(${articles.coAuthorIds}))`,
      ),
    )
    .orderBy(desc(articles.updatedAt));
}

/* ------------------------------------------------------------------ */
/* Creating and editing                                                */
/* ------------------------------------------------------------------ */

async function slugExists(candidate: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.slug, candidate), isNull(articles.deletedAt)))
    .limit(1);
  const found = rows[0];
  return found !== undefined && found.id !== exceptId;
}

/** Only editors create articles; there is no writer submission flow (§14). */
export async function createArticle(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Article> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const parsed = articleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Makale bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  if (input.authorId) await assertAuthorIsWriter(input.authorId);

  const slug = await uniqueSlug(input.title, (candidate) => slugExists(candidate));

  const [article] = await db
    .insert(articles)
    .values({
      title: input.title,
      slug,
      summary: input.summary ?? null,
      bodyMarkdown: input.bodyMarkdown ?? "",
      authorId: input.authorId ?? null,
      coAuthorIds: input.coAuthorIds ?? [],
      issueId: input.issueId ?? null,
      category: input.category ?? null,
      tags: input.tags ?? [],
      dueDate: input.dueDate ?? null,
      status: "draft",
    })
    .returning();

  await snapshotVersion(article!, actor.id, input.changeNote ?? "İlk sürüm");

  await writeAudit({
    actorId: actor.id,
    action: "article.created",
    entityType: "articles",
    entityId: article!.id,
    after: { title: article!.title, slug: article!.slug },
    ip: meta.ip,
  });

  return article!;
}

/** An author must actually hold the writer role or above (§4). */
async function assertAuthorIsWriter(authorId: string): Promise<void> {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(and(eq(users.id, authorId), isNull(users.deletedAt)))
    .limit(1);

  const role = rows[0]?.role;
  if (!role) throw badRequest("Yazar bulunamadı.");
  if (role === "user") throw badRequest("Yalnızca yazar rolündeki kullanıcılar makaleye atanabilir.");
}

export async function updateArticle(
  actor: Actor,
  articleId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Article> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const parsed = articleInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Makale bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;
  const existing = await findArticleById(articleId);

  if (input.authorId && input.authorId !== existing.authorId) {
    await assertAuthorIsWriter(input.authorId);
  }

  // The slug is part of the public URL, so it only follows the title while unpublished
  const slug =
    existing.publishedAt === null && input.title !== existing.title
      ? await uniqueSlug(input.title, (candidate) => slugExists(candidate, articleId))
      : existing.slug;

  const [updated] = await db
    .update(articles)
    .set({
      title: input.title,
      slug,
      summary: input.summary ?? null,
      bodyMarkdown: input.bodyMarkdown ?? existing.bodyMarkdown,
      authorId: input.authorId ?? existing.authorId,
      coAuthorIds: input.coAuthorIds ?? existing.coAuthorIds,
      issueId: input.issueId === undefined ? existing.issueId : input.issueId,
      category: input.category ?? null,
      tags: input.tags ?? existing.tags,
      dueDate: input.dueDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(articles.id, articleId))
    .returning();

  if (input.bodyMarkdown !== undefined && input.bodyMarkdown !== existing.bodyMarkdown) {
    await snapshotVersion(updated!, actor.id, input.changeNote ?? null);
  }

  await writeAudit({
    actorId: actor.id,
    action: "article.updated",
    entityType: "articles",
    entityId: articleId,
    before: { title: existing.title, authorId: existing.authorId },
    after: { title: updated!.title, authorId: updated!.authorId },
    ip: meta.ip,
  });

  return updated!;
}

/** Appends a numbered snapshot of the body to `article_versions`. */
async function snapshotVersion(
  article: Article,
  changedBy: string | null,
  changeNote: string | null,
  isPublishedSnapshot = false,
): Promise<void> {
  const latest = await db
    .select({ version: articleVersions.version })
    .from(articleVersions)
    .where(eq(articleVersions.articleId, article.id))
    .orderBy(desc(articleVersions.version))
    .limit(1);

  await db.insert(articleVersions).values({
    articleId: article.id,
    version: (latest[0]?.version ?? 0) + 1,
    bodyMarkdown: article.bodyMarkdown,
    changedBy,
    changeNote,
    isPublishedSnapshot,
  });
}

export async function listArticleVersions(actor: Actor, articleId: string) {
  const article = await findArticleById(articleId);
  if (!canReadArticle(actor, article)) throw forbidden();

  return db
    .select()
    .from(articleVersions)
    .where(eq(articleVersions.articleId, articleId))
    .orderBy(desc(articleVersions.version));
}

/* ------------------------------------------------------------------ */
/* Status transitions (§8)                                             */
/* ------------------------------------------------------------------ */

export type TransitionOptions = {
  withdrawnReason?: string;
  scheduledAt?: Date | null;
  note?: string;
};

/**
 * The only way an article's status changes. Refuses with 409 for any edge the
 * state machine does not allow, and for the guards it attaches.
 */
export async function transitionArticle(
  actor: Actor,
  articleId: string,
  to: ArticleStatus,
  meta: RequestMeta,
  options: TransitionOptions = {},
): Promise<Article> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const article = await findArticleById(articleId);
  const grant = await findActiveGrant(article.id);

  const check = checkTransition(article.status, to, {
    rightsGrantStatus: grant?.status ?? null,
    allMediaLicensed: await allMediaLicensed(article.id),
    withdrawnReason: options.withdrawnReason,
  });

  if (!check.ok) throw conflict(check.reason);

  const updated = await applyStatus(article, to, actor.id, meta, options);

  // `accepted` immediately becomes `awaiting_rights` and opens the form (§7.2)
  const next = autoTransitionAfter(to);
  if (next) {
    await createGrantForArticle(updated, { actorId: actor.id, ip: meta.ip });
    return applyStatus(updated, next, actor.id, meta, {});
  }

  return updated;
}

/** Writes the new status plus its side effects. Assumes the check already passed. */
async function applyStatus(
  article: Article,
  to: ArticleStatus,
  actorId: string | null,
  meta: RequestMeta,
  options: TransitionOptions,
): Promise<Article> {
  const now = new Date();

  const patch: Partial<typeof articles.$inferInsert> = { status: to, updatedAt: now };
  if (to === "published") patch.publishedAt = article.publishedAt ?? now;
  if (to === "scheduled") patch.scheduledAt = options.scheduledAt ?? article.scheduledAt ?? now;
  if (to === "withdrawn") {
    patch.withdrawnAt = now;
    patch.withdrawnReason = options.withdrawnReason ?? null;
  }
  if (to === "awaiting_rights") patch.scheduledAt = null;

  const [updated] = await db
    .update(articles)
    .set(patch)
    .where(eq(articles.id, article.id))
    .returning();

  if (to === "published") {
    await snapshotVersion(updated!, actorId, options.note ?? "Yayınlanan sürüm", true);
  }

  await writeAudit({
    actorId,
    action: `article.status_changed`,
    entityType: "articles",
    entityId: article.id,
    before: { status: article.status },
    after: { status: to, note: options.note ?? null },
    ip: meta.ip,
  });

  await notifyAuthorOfStatus(updated!, to, options.note);

  if (to === "published") {
    await triggerRevalidate({ type: "article.published", slug: updated!.slug });
  }
  if (to === "withdrawn") {
    await triggerRevalidate({ type: "article.withdrawn", slug: updated!.slug });
  }

  return updated!;
}

/** §12: the writer hears about revision requests, publication and withdrawal. */
async function notifyAuthorOfStatus(
  article: Article,
  status: ArticleStatus,
  note?: string,
): Promise<void> {
  const notifiable: ArticleStatus[] = ["revision_requested", "published", "withdrawn"];
  if (!notifiable.includes(status) || !article.authorId) return;

  const rows = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, article.authorId))
    .limit(1);
  const author = rows[0];
  if (!author) return;

  const message = templates.articleStatusChanged({
    displayName: author.displayName,
    articleTitle: article.title,
    status,
    note,
    url: `${env().APP_URL}/writer/articles`,
  });
  await sendMail({ to: author.email, subject: message.subject, text: message.text });
}

/**
 * Cron entry point (DECISIONS.md D-010): publishes everything whose scheduled
 * time has arrived, each one through the same guarded transition.
 */
export async function publishScheduledArticles(now: Date = new Date()): Promise<string[]> {
  const due = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.status, "scheduled"),
        isNull(articles.deletedAt),
        lte(articles.scheduledAt, now),
      ),
    );

  const published: string[] = [];
  for (const article of due) {
    const grant = await findActiveGrant(article.id);
    const check = checkTransition(article.status, "published", {
      rightsGrantStatus: grant?.status ?? null,
      allMediaLicensed: await allMediaLicensed(article.id),
    });
    if (!check.ok) {
      console.warn(`Scheduled article ${article.slug} not published: ${check.reason}`);
      continue;
    }
    await applyStatus(article, "published", null, { ip: null, userAgent: "cron" }, {});
    published.push(article.slug);
  }
  return published;
}

/**
 * A writer refusing a rights grant sends the article back for revision (§7.2).
 *
 * The writer is not an editor, so this cannot go through `transitionArticle`.
 * It still consults the state machine, and the edge it uses is only legal once
 * the grant is actually declined — which the line above has just made true.
 */
export async function declineRightsGrantAndReturnForRevision(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Article> {
  const grant = await declineRightsGrant(actor, rawInput, meta);
  const article = await findArticleById(grant.articleId);

  const check = checkTransition(article.status, "revision_requested", {
    rightsGrantStatus: grant.status,
    allMediaLicensed: await allMediaLicensed(article.id),
  });
  if (!check.ok) throw conflict(check.reason);

  const updated = await applyStatus(article, "revision_requested", actor.id, meta, {
    note: grant.declinedReason ?? undefined,
  });

  await notifyEditors(
    "Devir formu reddedildi",
    `"${article.title}" için hak devri formu reddedildi. Gerekçe: ${grant.declinedReason ?? "-"}`,
    `/editor/articles/${article.id}`,
  );

  return updated;
}

/** Panel-side notification to everyone who can act on it. */
async function notifyEditors(title: string, body: string, href: string): Promise<void> {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, ["editor", "admin"]), isNull(users.deletedAt)));

  if (recipients.length === 0) return;

  await db.insert(notifications).values(
    recipients.map((recipient) => ({
      userId: recipient.id,
      kind: "editorial",
      title,
      body,
      href,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Editorial notes and plagiarism flag                                 */
/* ------------------------------------------------------------------ */

export async function addComment(
  actor: Actor,
  articleId: string,
  body: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  if (body.trim().length < 2) throw badRequest("Not boş olamaz.");

  await db.insert(articleComments).values({ articleId, authorId: actor.id, body: body.trim() });

  await writeAudit({
    actorId: actor.id,
    action: "article.comment_added",
    entityType: "articles",
    entityId: articleId,
    ip: meta.ip,
  });
}

/** Writers see editorial notes but cannot write them (§9.1). */
export async function listComments(actor: Actor, articleId: string) {
  const article = await findArticleById(articleId);
  if (!canReadArticle(actor, article)) throw forbidden();

  return db
    .select({
      id: articleComments.id,
      body: articleComments.body,
      createdAt: articleComments.createdAt,
      resolvedAt: articleComments.resolvedAt,
      authorName: users.displayName,
    })
    .from(articleComments)
    .leftJoin(users, eq(articleComments.authorId, users.id))
    .where(and(eq(articleComments.articleId, articleId), isNull(articleComments.deletedAt)))
    .orderBy(asc(articleComments.createdAt));
}

export async function resolveComment(actor: Actor, commentId: string): Promise<void> {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  await db
    .update(articleComments)
    .set({ resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(articleComments.id, commentId));
}

export async function setPlagiarismStatus(
  actor: Actor,
  articleId: string,
  status: "not_run" | "clean" | "flagged",
  note: string | null,
  meta: RequestMeta,
): Promise<Article> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const [updated] = await db
    .update(articles)
    .set({ plagiarismCheckStatus: status, plagiarismNote: note, updatedAt: new Date() })
    .where(eq(articles.id, articleId))
    .returning();

  if (!updated) throw notFound("Makale bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "article.plagiarism_status_set",
    entityType: "articles",
    entityId: articleId,
    after: { status, note },
    ip: meta.ip,
  });

  return updated;
}
