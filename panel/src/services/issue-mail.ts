/**
 * Mail that follows an issue's calendar: the topic window opening (D-272) and
 * the delivery window opening (D-270).
 *
 * Nothing is scheduled ahead: every run asks "which windows have opened and
 * not yet been announced?", so a date the admin moves is simply picked up at
 * its new time.
 *
 * Each opening is claimed once through a `site_settings` row whose key names
 * the window, the issue and the opening moment: the key is the table's primary
 * key, so of two runs that meet (two dashboard views, the cron) only one
 * inserts it and sends. A reopened window has a new moment, hence a new key.
 *
 * Runs from the daily cron, from `/api/cron/mail` and after the panel
 * dashboards render — the last is what sends it close to the minute, since
 * the Hobby cron runs once a day.
 */
import "server-only";
import { TEST_WRITER_EMAILS } from "@/lib/test-accounts";
import { and, eq, gt, gte, inArray, isNotNull, isNull, lte, ne, notInArray } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, siteSettings, topicProposals, users, type Issue } from "@/db/schema";
import { runInBackground } from "@/lib/background";
import { env } from "@/lib/env";
import { formatPeriodMoment } from "@/lib/issue-periods";
import { queueMails } from "@/services/mail-queue";
import { notify } from "@/services/notifications";
import * as templates from "@emails/templates";

/** A window found open later than this is stale news and is not announced any more. */
export const ANNOUNCE_GRACE_MS = 3 * 86_400_000;

type WindowKind = "topic" | "submission";

const WINDOW_COLUMNS = {
  topic: { opens: issues.topicOpensAt, closes: issues.topicClosesAt },
  submission: { opens: issues.submissionOpensAt, closes: issues.submissionClosesAt },
} as const;

function opensAtOf(issue: Issue, kind: WindowKind): Date {
  return kind === "topic" ? issue.topicOpensAt! : issue.submissionOpensAt!;
}

/** The claim row's key; the delivery one keeps the name it went live with (D-270). */
export function announcementKey(issueId: string, opensAt: Date, kind: WindowKind = "submission"): string {
  const name = kind === "topic" ? "topic_open" : "submission_open";
  return `announced.${name}.${issueId}.${opensAt.getTime()}`;
}

/** Issues whose window of this kind opened recently and is still open. */
async function openedIssues(kind: WindowKind, now: Date): Promise<Issue[]> {
  const columns = WINDOW_COLUMNS[kind];
  return db
    .select()
    .from(issues)
    .where(
      and(
        isNull(issues.deletedAt),
        // The admins' working issue stays theirs (D-240)
        eq(issues.adminOnly, false),
        isNotNull(columns.opens),
        lte(columns.opens, now),
        gte(columns.opens, new Date(now.getTime() - ANNOUNCE_GRACE_MS)),
        gt(columns.closes, now),
      ),
    );
}

/** Claims and announces each newly opened window of this kind. Returns mails queued. */
async function announce(kind: WindowKind, now: Date): Promise<number> {
  let sent = 0;
  for (const issue of await openedIssues(kind, now)) {
    const claimed = await db
      .insert(siteSettings)
      .values({ key: announcementKey(issue.id, opensAtOf(issue, kind), kind), value: now.toISOString() })
      .onConflictDoNothing()
      .returning({ key: siteSettings.key });
    if (claimed.length === 0) continue;

    sent += kind === "topic" ? await mailTopicWindow(issue) : await mailSubmissionWindow(issue);
  }
  return sent;
}

export async function announceOpenedTopicWindows(now: Date = new Date()): Promise<number> {
  return announce("topic", now);
}

export async function announceOpenedSubmissionWindows(now: Date = new Date()): Promise<number> {
  return announce("submission", now);
}

/** Both windows, for the cron and the dashboards. */
export async function announceOpenedIssueWindows(now: Date = new Date()): Promise<number> {
  return (await announceOpenedTopicWindows(now)) + (await announceOpenedSubmissionWindows(now));
}

/**
 * Everyone who may propose a topic and hand in an article: the same test as
 * `isActiveWriter`, except the admins, who write when they choose and are not
 * mailed about windows (D-304).
 */
async function activeWriters() {
  return db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      writerArea: users.writerArea,
      writerArea2: users.writerArea2,
    })
    .from(users)
    .where(
      and(
        eq(users.writerStatus, "active"),
        ne(users.role, "user"),
        eq(users.isBanned, false),
        isNull(users.deletedAt),
        isNull(users.anonymizedAt),
        isNotNull(users.emailVerifiedAt),
        // A test writer is not mailed with the roster (D-333)
        notInArray(users.email, [...TEST_WRITER_EMAILS]),
      ),
    );
}

function issueLabel(issue: Issue): string {
  return `Sayı ${issue.number} · ${issue.title}`;
}

async function mailTopicWindow(issue: Issue): Promise<number> {
  const writers = await activeWriters();
  if (writers.length === 0) return 0;

  const label = issueLabel(issue);
  const closesAt = formatPeriodMoment(issue.topicClosesAt!);
  const url = `${env().APP_URL}/writer/topics`;

  for (const writer of writers) {
    // The bell in the panel too, for whoever reads the panel before the mail
    await notify({
      userId: writer.id,
      kind: "issue.topic_opened",
      title: `${label}: konu belirleme dönemi başladı`,
      body: `Son gün: ${closesAt}`,
      href: "/writer/topics",
    });
  }

  const opensKey = issue.topicOpensAt!.getTime();
  return queueMails(
    writers.map((writer) => ({
      to: writer.email,
      ...templates.topicWindowOpened({
        displayName: writer.displayName,
        issueLabel: label,
        theme: issue.theme,
        closesAt,
        areas: [writer.writerArea, writer.writerArea2].filter((area): area is string => Boolean(area)),
        url,
      }),
      dedupeKey: `topic-open:${issue.id}:${opensKey}:${writer.id}`,
    })),
  );
}

async function mailSubmissionWindow(issue: Issue): Promise<number> {
  const writers = await activeWriters();
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

  const label = issueLabel(issue);
  const closesAt = formatPeriodMoment(issue.submissionClosesAt!);
  const url = `${env().APP_URL}/writer/topics`;

  for (const writer of writers) {
    await notify({
      userId: writer.id,
      kind: "issue.submission_opened",
      title: `${label}: yazı kabul dönemi başladı`,
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
        issueLabel: label,
        closesAt,
        // A writer with two areas may have two accepted topics (D-271)
        acceptedTopic:
          accepted
            .filter((row) => row.authorId === writer.id)
            .map((row) => row.title)
            .join(", ") || null,
        url,
      }),
      dedupeKey: `submission-open:${issue.id}:${opensKey}:${writer.id}`,
    })),
  );
}

/** For the dashboards: checked after the response, never in the reader's way. */
export async function announceOpenedSubmissionWindowsSoon(): Promise<void> {
  await runInBackground(async () => {
    await announceOpenedIssueWindows();
  });
}
