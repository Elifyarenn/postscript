/**
 * Mail that follows an issue's calendar (D-270).
 *
 * Nothing is scheduled ahead: every run asks "which delivery windows have
 * opened and not yet been announced?", so a date the admin moves is simply
 * picked up at its new time.
 *
 * Each opening is claimed once through a `site_settings` row whose key names
 * the issue and the opening moment: the key is the table's primary key, so of
 * two runs that meet (two dashboard views, the cron) only one inserts it and
 * sends. A reopened window has a new moment, hence a new key.
 *
 * Runs from the daily cron, from `/api/cron/mail` and after the panel
 * dashboards render — the last is what sends it close to the minute, since
 * the Hobby cron runs once a day.
 */
import "server-only";
import { and, eq, gt, gte, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, siteSettings, topicProposals, users } from "@/db/schema";
import { runInBackground } from "@/lib/background";
import { env } from "@/lib/env";
import { formatPeriodMoment } from "@/lib/issue-periods";
import { queueMails } from "@/services/mail-queue";
import { notify } from "@/services/notifications";
import * as templates from "@emails/templates";

/** A window found open later than this is stale news and is not announced any more. */
export const ANNOUNCE_GRACE_MS = 3 * 86_400_000;

export function announcementKey(issueId: string, opensAt: Date): string {
  return `announced.submission_open.${issueId}.${opensAt.getTime()}`;
}

/** Mails every active writer about each delivery window that has opened. Returns mails sent. */
export async function announceOpenedSubmissionWindows(now: Date = new Date()): Promise<number> {
  const opened = await db
    .select()
    .from(issues)
    .where(
      and(
        isNull(issues.deletedAt),
        // The admins' working issue stays theirs (D-240)
        eq(issues.adminOnly, false),
        isNotNull(issues.submissionOpensAt),
        lte(issues.submissionOpensAt, now),
        gte(issues.submissionOpensAt, new Date(now.getTime() - ANNOUNCE_GRACE_MS)),
        gt(issues.submissionClosesAt, now),
      ),
    );

  let sent = 0;
  for (const issue of opened) {
    const claimed = await db
      .insert(siteSettings)
      .values({ key: announcementKey(issue.id, issue.submissionOpensAt!), value: now.toISOString() })
      .onConflictDoNothing()
      .returning({ key: siteSettings.key });
    if (claimed.length === 0) continue;

    sent += await mailWriters(issue);
  }
  return sent;
}

async function mailWriters(issue: typeof issues.$inferSelect): Promise<number> {
  // Everyone who may hand in an article: the same test as `isActiveWriter`
  const writers = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(
      and(
        eq(users.writerStatus, "active"),
        ne(users.role, "user"),
        eq(users.isBanned, false),
        isNull(users.deletedAt),
        isNull(users.anonymizedAt),
        isNotNull(users.emailVerifiedAt),
      ),
    );
  if (writers.length === 0) return 0;

  const accepted = await db
    .select({ authorId: topicProposals.authorId, title: topicProposals.title })
    .from(topicProposals)
    .where(
      and(
        eq(topicProposals.issueId, issue.id),
        eq(topicProposals.status, "accepted"),
        isNull(topicProposals.deletedAt),
        inArray(
          topicProposals.authorId,
          writers.map((writer) => writer.id),
        ),
      ),
    );

  const issueLabel = `Sayı ${issue.number} · ${issue.title}`;
  const closesAt = formatPeriodMoment(issue.submissionClosesAt!);
  const url = `${env().APP_URL}/writer/topics`;

  for (const writer of writers) {
    // The bell in the panel too, for whoever reads the panel before the mail
    await notify({
      userId: writer.id,
      kind: "issue.submission_opened",
      title: `${issueLabel}: yazı kabul dönemi başladı`,
      body: `Son teslim: ${closesAt}`,
      href: "/writer/topics",
    });
  }

  // Queued, so a failed address is retried and every send shows on /admin/mail (D-269)
  const opensKey = issue.submissionOpensAt!.getTime();
  return queueMails(
    writers.map((writer) => ({
      to: writer.email,
      ...templates.submissionWindowOpened({
        displayName: writer.displayName,
        issueLabel,
        closesAt,
        acceptedTopic: accepted.find((row) => row.authorId === writer.id)?.title ?? null,
        url,
      }),
      dedupeKey: `submission-open:${issue.id}:${opensKey}:${writer.id}`,
    })),
  );
}

/** For the dashboards: checked after the response, never in the reader's way. */
export async function announceOpenedSubmissionWindowsSoon(): Promise<void> {
  await runInBackground(async () => {
    await announceOpenedSubmissionWindows();
  });
}
