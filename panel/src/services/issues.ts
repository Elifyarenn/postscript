/**
 * Issues: planning, ordering and publication (§9.2).
 */
import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, issues, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { triggerRevalidate } from "@/lib/revalidate";
import type { RequestMeta } from "./auth";

export const issueInputSchema = z.strictObject({
  number: z.number().int().positive(),
  title: z.string().trim().min(2).max(200),
  theme: z.string().trim().max(200).optional().nullable(),
  coverMediaId: z.uuid().optional().nullable(),
  plannedPublishDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});

export async function listIssues(actor: Actor) {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  return db
    .select()
    .from(issues)
    .where(isNull(issues.deletedAt))
    .orderBy(desc(issues.number));
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
  if (!canAccessEditorPanel(actor)) throw forbidden();

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
      coverMediaId: parsed.data.coverMediaId ?? null,
      plannedPublishDate: parsed.data.plannedPublishDate ?? null,
      status: "planning",
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "issue.created",
    entityType: "issues",
    entityId: issue!.id,
    after: { number: issue!.number, title: issue!.title },
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
  if (!canAccessEditorPanel(actor)) throw forbidden();

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
      coverMediaId: parsed.data.coverMediaId ?? null,
      plannedPublishDate: parsed.data.plannedPublishDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "issue.updated",
    entityType: "issues",
    entityId: issueId,
    before: { number: existing.number, title: existing.title },
    after: { number: updated!.number, title: updated!.title },
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
  if (!canAccessEditorPanel(actor)) throw forbidden();

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

/** Drag and drop ordering in the editor panel: the whole order arrives at once. */
export async function reorderArticles(
  actor: Actor,
  issueId: string,
  orderedArticleIds: string[],
  meta: RequestMeta,
): Promise<void> {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  await findIssue(issueId);

  await db.transaction(async (tx) => {
    for (const [index, articleId] of orderedArticleIds.entries()) {
      await tx
        .update(articles)
        .set({ orderInIssue: index + 1, issueId, updatedAt: new Date() })
        .where(eq(articles.id, articleId));
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
