import "server-only";
import { and, eq, isNull, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, issueViewDays } from "@/db/schema";
import { canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { notFound } from "@/lib/errors";
import { TURKEY_TIME_ZONE } from "@/lib/utils";
import { mayReadIssue } from "./issue-pages";

/**
 * How many times an issue was read (D-344).
 *
 * The reader reports an opening once a day per browser, a mark the browser
 * keeps in its own storage and never sends. The server stores a number per
 * issue and day and nothing else: no address, no account, no browser, so no
 * personal data is processed to count. The team's own visits are left out,
 * because they open an issue far more often than a reader does.
 */

/** Today's date in Turkey, as the `date` column stores it. */
export function turkeyDay(now: Date = new Date()): string {
  // en-CA writes YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TURKEY_TIME_ZONE }).format(now);
}

/**
 * Counts one opening of a published issue. A closed issue answers 404, as
 * its reader does, so the count cannot be used to find one.
 */
export async function recordIssueView(
  actor: Actor | null,
  number: number,
  now: Date = new Date(),
): Promise<{ counted: boolean }> {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.number, number), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue || !mayReadIssue(null, issue)) throw notFound("Sayı bulunamadı.");
  if (actor && canAccessEditorPanel(actor)) return { counted: false };

  // One statement, so two readers at once both count (the D-250 pattern); a
  // date string, not a Date, so no timestamp passes through raw SQL
  await db
    .insert(issueViewDays)
    .values({ issueId: issue.id, day: turkeyDay(now), views: 1 })
    .onConflictDoUpdate({
      target: [issueViewDays.issueId, issueViewDays.day],
      set: { views: sql`${issueViewDays.views} + 1` },
    });
  return { counted: true };
}

/** All the openings an issue has had. */
export async function issueViewTotal(issueId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(issueViewDays.views) })
    .from(issueViewDays)
    .where(eq(issueViewDays.issueId, issueId));
  return Number(row?.total ?? 0);
}
