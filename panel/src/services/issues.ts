/**
 * Issues: planning, ordering and publication (§9.2).
 *
 * Issue management is the admin's business since the editor panel was narrowed
 * to review and media (D-059); reading stays open to every editor.
 */
import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, issues, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { triggerRevalidate } from "@/lib/revalidate";
import type { RequestMeta } from "./auth";

const windowEnd = z.date().nullable().optional();

/** Both ends or neither, the start first; the database holds the same rule (D-261). */
function windowIsOrdered(opensAt: Date | null | undefined, closesAt: Date | null | undefined): boolean {
  if (!opensAt && !closesAt) return true;
  return Boolean(opensAt && closesAt && opensAt.getTime() < closesAt.getTime());
}

export const issueInputSchema = z
  .strictObject({
    number: z.number().int().positive(),
    title: z.string().trim().min(2).max(200),
    theme: z.string().trim().max(200).optional().nullable(),
    blurb: z.string().trim().max(600).optional().nullable(),
    coverMediaId: z.uuid().optional().nullable(),
    plannedPublishDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    // The topic and delivery windows (D-261)
    topicOpensAt: windowEnd,
    topicClosesAt: windowEnd,
    submissionOpensAt: windowEnd,
    submissionClosesAt: windowEnd,
  })
  .refine((value) => windowIsOrdered(value.topicOpensAt, value.topicClosesAt), {
    message: "Konu belirleme: başlangıç, bitişten önce olmalı; ikisi birlikte girilmeli.",
    path: ["topicOpensAt"],
  })
  .refine((value) => windowIsOrdered(value.submissionOpensAt, value.submissionClosesAt), {
    message: "Yazı kabulü: başlangıç, bitişten önce olmalı; ikisi birlikte girilmeli.",
    path: ["submissionOpensAt"],
  });

function windowValues(input: z.infer<typeof issueInputSchema>) {
  return {
    topicOpensAt: input.topicOpensAt ?? null,
    topicClosesAt: input.topicClosesAt ?? null,
    submissionOpensAt: input.submissionOpensAt ?? null,
    submissionClosesAt: input.submissionClosesAt ?? null,
  };
}

export async function listIssues(actor: Actor) {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  // The working issue is the admins' own; an editor is not shown that it
  // exists, here or anywhere else (D-240)
  const visible = canAccessAdminPanel(actor)
    ? isNull(issues.deletedAt)
    : and(isNull(issues.deletedAt), eq(issues.adminOnly, false));

  return db.select().from(issues).where(visible).orderBy(desc(issues.number));
}

export async function findIssue(issueId: string): Promise<Issue> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Sayı bulunamadı.");
  return row;
}

export async function createIssue(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Issue> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Sayı yönetimi yalnızca yöneticinindir (D-059).");

  const parsed = issueInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Sayı bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const clash = await db
    .select({ id: issues.id })
    .from(issues)
    .where(and(eq(issues.number, parsed.data.number), isNull(issues.deletedAt)))
    .limit(1);
  if (clash.length > 0) throw conflict("Bu numaraya sahip bir sayı zaten var.");

  const [issue] = await db
    .insert(issues)
    .values({
      number: parsed.data.number,
      title: parsed.data.title,
      theme: parsed.data.theme ?? null,
      blurb: parsed.data.blurb ?? null,
      coverMediaId: parsed.data.coverMediaId ?? null,
      plannedPublishDate: parsed.data.plannedPublishDate ?? null,
      ...windowValues(parsed.data),
      status: "planning",
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "issue.created",
    entityType: "issues",
    entityId: issue!.id,
    after: { number: issue!.number, title: issue!.title, ...windowValues(parsed.data) },
    ip: meta.ip,
  });

  return issue!;
}

export async function updateIssue(
  actor: Actor,
  issueId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Issue> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Sayı yönetimi yalnızca yöneticinindir (D-059).");

  const parsed = issueInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Sayı bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const existing = await findIssue(issueId);

  const [updated] = await db
    .update(issues)
    .set({
      number: parsed.data.number,
      title: parsed.data.title,
      theme: parsed.data.theme ?? null,
      blurb: parsed.data.blurb ?? null,
      coverMediaId: parsed.data.coverMediaId ?? null,
      plannedPublishDate: parsed.data.plannedPublishDate ?? null,
      ...windowValues(parsed.data),
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "issue.updated",
    entityType: "issues",
    entityId: issueId,
    before: {
      number: existing.number,
      title: existing.title,
      topicOpensAt: existing.topicOpensAt,
      topicClosesAt: existing.topicClosesAt,
      submissionOpensAt: existing.submissionOpensAt,
      submissionClosesAt: existing.submissionClosesAt,
    },
    after: { number: updated!.number, title: updated!.title, ...windowValues(parsed.data) },
    ip: meta.ip,
  });

  return updated!;
}

export async function setIssueStatus(
  actor: Actor,
  issueId: string,
  status: "planning" | "in_production" | "published" | "archived",
  meta: RequestMeta,
): Promise<Issue> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Sayı yönetimi yalnızca yöneticinindir (D-059).");

  const existing = await findIssue(issueId);
  const now = new Date();

  const [updated] = await db
    .update(issues)
    .set({
      status,
      publishedAt: status === "published" ? (existing.publishedAt ?? now) : existing.publishedAt,
      updatedAt: now,
    })
    .where(eq(issues.id, issueId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "issue.status_changed",
    entityType: "issues",
    entityId: issueId,
    before: { status: existing.status },
    after: { status },
    ip: meta.ip,
  });

  if (status === "published") {
    await triggerRevalidate({ type: "issue.published", issueNumber: updated!.number });
  }

  return updated!;
}

/** Drag and drop ordering: the whole order arrives at once. */
export async function reorderArticles(
  actor: Actor,
  issueId: string,
  orderedArticleIds: string[],
  meta: RequestMeta,
): Promise<void> {
  if (!canAccessAdminPanel(actor)) throw forbidden("Sayı yönetimi yalnızca yöneticinindir (D-059).");
  await findIssue(issueId);

  await db.transaction(async (tx) => {
    for (const [index, articleId] of orderedArticleIds.entries()) {
      await tx
        .update(articles)
        .set({ orderInIssue: index + 1, updatedAt: new Date() })
        // Ordering never moves an article from another issue into this one (D-261)
        .where(and(eq(articles.id, articleId), eq(articles.issueId, issueId)));
    }
  });

  await writeAudit({
    actorId: actor.id,
    action: "issue.articles_reordered",
    entityType: "issues",
    entityId: issueId,
    after: { order: orderedArticleIds },
    ip: meta.ip,
  });
}

export async function listIssueArticles(issueId: string) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      status: articles.status,
      orderInIssue: articles.orderInIssue,
      authorId: articles.authorId,
    })
    .from(articles)
    .where(and(eq(articles.issueId, issueId), isNull(articles.deletedAt)))
    .orderBy(asc(articles.orderInIssue), asc(articles.createdAt));
}