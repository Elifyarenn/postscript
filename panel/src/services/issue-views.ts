import "server-only";
import { and, desc, eq, isNull, sql, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, issueViewDays } from "@/db/schema";
import { canAccessAdminPanel, canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { forbidden, notFound } from "@/lib/errors";
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

export type IssueViewReport = {
  issueId: string;
  number: number;
  title: string;
  status: (typeof issues.$inferSelect)["status"];
  total: number;
  /** Today and the six days before it, in Turkey's time. */
  last7Days: number;
  last30Days: number;
  /** Every counted day, newest first; a day nobody opened the issue has no row. */
  days: { day: string; views: number }[];
};

/**
 * Every issue's openings for the admins (D-383): the published ones, and any
 * other that was counted while it was open. Only numbers per day exist to
 * show; the sums are taken here, so no date passes through SQL (D-078).
 */
export async function issueViewReport(actor: Actor, now: Date = new Date()): Promise<IssueViewReport[]> {
  if (!canAccessAdminPanel(actor)) throw forbidden();

  const [issueRows, viewRows] = await Promise.all([
    db
      .select({ id: issues.id, number: issues.number, title: issues.title, status: issues.status })
      .from(issues)
      .where(isNull(issues.deletedAt))
      .orderBy(desc(issues.number)),
    db.select().from(issueViewDays),
  ]);

  const today = turkeyDay(now);
  const since7 = turkeyDay(new Date(now.getTime() - 6 * 86_400_000));
  const since30 = turkeyDay(new Date(now.getTime() - 29 * 86_400_000));

  return issueRows
    .map((issue) => {
      const days = viewRows
        .filter((row) => row.issueId === issue.id)
        .map((row) => ({ day: row.day, views: row.views }))
        // YYYY-MM-DD sorts as text
        .sort((a, b) => b.day.localeCompare(a.day));
      const sumFrom = (since: string) =>
        days.filter((row) => row.day >= since && row.day <= today).reduce((total, row) => total + row.views, 0);
      return {
        issueId: issue.id,
        number: issue.number,
        title: issue.title,
        status: issue.status,
        total: days.reduce((total, row) => total + row.views, 0),
        last7Days: sumFrom(since7),
        last30Days: sumFrom(since30),
        days,
      };
    })
    .filter((row) => row.days.length > 0 || row.status === "published" || row.status === "archived");
}

/** All the openings an issue has had. */
export async function issueViewTotal(issueId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(issueViewDays.views) })
    .from(issueViewDays)
    .where(eq(issueViewDays.issueId, issueId));
  return Number(row?.total ?? 0);
}
