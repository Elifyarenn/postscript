/**
 * The 1600-word category budget, enforced (D-331). Every write that can grow
 * a category's total in an issue (a new article, an edit, a category or issue
 * change) calls `assertCategoryBudget` inside its own transaction: the issue
 * row is locked first, so two saves into the same issue run one after the
 * other and cannot both slip under the limit.
 */
import "server-only";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, issues } from "@/db/schema";
import type { Executor } from "@/lib/audit";
import { budgetRefusal, checkCategoryBudget, CATEGORY_WORD_LIMIT } from "@/lib/category-budget";
import { countWords } from "@/lib/word-count";
import { conflict, notFound } from "@/lib/errors";

/** A withdrawn article has left the issue; every other one counts, drafts too. */
function inBudget(issueId: string) {
  return and(eq(articles.issueId, issueId), isNull(articles.deletedAt), ne(articles.status, "withdrawn"));
}

/** Words per category in one issue, leaving one article out when given. */
export async function categoryWordTotals(
  issueId: string,
  exceptArticleId?: string,
  executor: Executor = db,
): Promise<Map<string, number>> {
  const rows = await executor
    .select({ id: articles.id, category: articles.category, bodyMarkdown: articles.bodyMarkdown })
    .from(articles)
    .where(inBudget(issueId));
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.category || row.id === exceptArticleId) continue;
    totals.set(row.category, (totals.get(row.category) ?? 0) + countWords(row.bodyMarkdown));
  }
  return totals;
}

export type BudgetChange = {
  /** Where the article will be after the save. */
  issueId: string;
  category: string | null;
  body: string;
  /** The stored article, for an edit; absent for a new one. */
  existing?: { id: string; issueId: string; category: string | null; bodyMarkdown: string };
};

/**
 * Throws 409 when the save would take the category over the limit. Must run
 * inside the transaction that writes the article.
 */
export async function assertCategoryBudget(tx: Executor, change: BudgetChange): Promise<void> {
  if (!change.category) return;

  // The lock that serialises concurrent saves into this issue
  const [issue] = await tx
    .select({ id: issues.id, number: issues.number })
    .from(issues)
    .where(eq(issues.id, change.issueId))
    .for("update");
  if (!issue) throw notFound("Sayı bulunamadı.");

  const totals = await categoryWordTotals(change.issueId, change.existing?.id, tx);
  const others = totals.get(change.category) ?? 0;
  const sameBucket =
    change.existing !== undefined &&
    change.existing.issueId === change.issueId &&
    change.existing.category === change.category;
  const after = countWords(change.body);
  const check = checkCategoryBudget({
    others,
    before: sameBucket ? countWords(change.existing!.bodyMarkdown) : 0,
    after,
  });
  if (!check.ok) {
    throw conflict(
      budgetRefusal({ category: change.category, issueNumber: issue.number, others, after, limit: CATEGORY_WORD_LIMIT }),
    );
  }
}

/** What a form needs to show the budget live: the other articles' totals and the issue's number. */
export async function categoryBudgetForForm(
  issueId: string,
  exceptArticleId?: string,
): Promise<{ totals: Record<string, number>; issueNumber: number } | null> {
  const [issue] = await db.select({ number: issues.number }).from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!issue) return null;
  const totals = await categoryWordTotals(issueId, exceptArticleId);
  return { totals: Object.fromEntries(totals), issueNumber: issue.number };
}
