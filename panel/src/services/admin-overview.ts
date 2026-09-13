/**
 * What is waiting on the admin, counted for the dashboard (D-097).
 *
 * The admins mostly look in from a phone, so the first screen has to say at a
 * glance whether anything needs them. Each count is the same queue its own
 * page lists; nothing here decides anything.
 */
import "server-only";
import { and, count, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, contentReports, writerApplications } from "@/db/schema";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { forbidden } from "@/lib/errors";
import { REPORT_RESPONSE_HOURS } from "@/lib/reports";

export type PendingAdminWork = {
  /** Content reports nobody has decided yet. */
  openReports: number;
  /** Of those, the ones past the 24 hour answer window of 5651 m. 9. */
  overdueReports: number;
  /** Applications the editor approved; only the admin can take them further. */
  applicationsAwaitingAdmin: number;
  /** Articles the main editor handed on; only the admin accepts them (D-059). */
  articlesAwaitingAdmin: number;
};

export async function pendingAdminWork(
  actor: Actor,
  now: Date = new Date(),
): Promise<PendingAdminWork> {
  if (!canAccessAdminPanel(actor)) throw forbidden();

  // Same edge as isReportOverdue: late once more than the window has passed
  const deadline = new Date(now.getTime() - REPORT_RESPONSE_HOURS * 60 * 60_000);

  const [open, overdue, applications, queuedArticles] = await Promise.all([
    db.select({ total: count() }).from(contentReports).where(eq(contentReports.status, "open")),
    db
      .select({ total: count() })
      .from(contentReports)
      .where(and(eq(contentReports.status, "open"), lt(contentReports.createdAt, deadline))),
    db
      .select({ total: count() })
      .from(writerApplications)
      .where(eq(writerApplications.status, "editor_approved")),
    db
      .select({ total: count() })
      .from(articles)
      .where(and(eq(articles.status, "ready_for_publishing"), isNull(articles.deletedAt))),
  ]);

  return {
    openReports: open[0]?.total ?? 0,
    overdueReports: overdue[0]?.total ?? 0,
    applicationsAwaitingAdmin: applications[0]?.total ?? 0,
    articlesAwaitingAdmin: queuedArticles[0]?.total ?? 0,
  };
}
