/**
 * Daily housekeeping (D-103).
 *
 * The retention periods the KVKK notice promises and the jobs the README used
 * to hand to crontab all run from here, once a day, through Vercel Cron. The
 * pnpm scripts call the same functions, so a manual run and the scheduled run
 * cannot drift apart.
 */
import "server-only";
import { and, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { pendingRegistrations, sessions, users } from "@/db/schema";
import { pruneAttempts } from "@/lib/rate-limit";
import { pruneTrafficLogs } from "@/lib/traffic";
import { pruneDeletedAnonMessages } from "@/services/anon-box";
import { publishScheduledArticles } from "@/services/articles";
import { pruneDeletedCommunityContent } from "@/services/community";
import { pruneDeletedDirectMessages } from "@/services/direct-messages";
import { pruneDeletedPosts } from "@/services/posts";
import { pruneResolvedReports } from "@/services/reports";
import { sendApprovalReminders } from "@/services/rights";
import { anonymiseUser } from "@/services/users";

const DAY_MS = 86_400_000;

/** KVKK notice §7: a deletion request is carried out after 30 days (D-066). */
export const DELETION_GRACE_DAYS = 30;
/** KVKK notice §7: registrations whose address was never verified go after 7 days. */
export const UNVERIFIED_GRACE_DAYS = 7;
/** KVKK notice §7: login attempt records are kept at most 30 days. */
export const AUTH_ATTEMPT_RETENTION_DAYS = 30;
/** KVKK notice §7 and 5651 m. 5: session records (IP, browser) are kept one year. */
export const SESSION_RETENTION_DAYS = 365;

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/**
 * Deletes sessions that were last used more than a year ago. Counting from the
 * last use rather than from sign-in keeps every request's IP for at least the
 * full year 5651 asks for. A session that is somehow still valid is never
 * touched, whatever its age.
 */
export async function pruneEndedSessions(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(
      and(
        lt(sessions.lastSeenAt, daysBefore(now, SESSION_RETENTION_DAYS)),
        lt(sessions.expiresAt, now),
      ),
    )
    .returning({ id: sessions.id });
  return removed.length;
}

/** Anonymises accounts whose deletion request has waited out its grace period. */
export async function processDueDeletions(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletionRequestedAt),
        isNull(users.deletedAt),
        lte(users.deletionRequestedAt, daysBefore(now, DELETION_GRACE_DAYS)),
      ),
    );
  for (const account of due) await anonymiseUser(account.id);
  return due.length;
}

/** Removes never-verified accounts after the grace period, and expired pending sign-ups. */
export async function purgeUnverifiedAccounts(
  now: Date = new Date(),
): Promise<{ accounts: number; pendingRegistrations: number }> {
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.emailVerifiedAt),
        isNull(users.deletedAt),
        lte(users.createdAt, daysBefore(now, UNVERIFIED_GRACE_DAYS)),
      ),
    );
  for (const account of stale) await anonymiseUser(account.id);

  const expiredPending = await db
    .delete(pendingRegistrations)
    .where(and(isNull(pendingRegistrations.usedAt), lte(pendingRegistrations.expiresAt, now)))
    .returning({ id: pendingRegistrations.id });

  return { accounts: stale.length, pendingRegistrations: expiredPending.length };
}

export type HousekeepingTask = {
  name: string;
  run: (now: Date) => Promise<unknown>;
};

/** Everything the daily run does, in order. Publishing goes first so readers wait least. */
export const DAILY_TASKS: readonly HousekeepingTask[] = [
  { name: "publish_scheduled", run: async (now) => (await publishScheduledArticles(now)).length },
  { name: "approval_reminders", run: sendApprovalReminders },
  { name: "process_deletions", run: processDueDeletions },
  { name: "purge_unverified", run: purgeUnverifiedAccounts },
  { name: "prune_traffic", run: pruneTrafficLogs },
  { name: "prune_posts", run: pruneDeletedPosts },
  { name: "prune_community", run: pruneDeletedCommunityContent },
  { name: "prune_direct_messages", run: pruneDeletedDirectMessages },
  { name: "prune_anon_messages", run: pruneDeletedAnonMessages },
  { name: "prune_reports", run: pruneResolvedReports },
  {
    name: "prune_auth_attempts",
    run: async (now) => {
      await pruneAttempts(daysBefore(now, AUTH_ATTEMPT_RETENTION_DAYS));
      return null;
    },
  },
  { name: "prune_sessions", run: pruneEndedSessions },
];

export type TaskOutcome =
  | { name: string; ok: true; result: unknown }
  | { name: string; ok: false; error: string };

function firstLine(value: unknown): string {
  return (value instanceof Error ? value.message : String(value)).split("\n")[0] ?? "";
}

/**
 * Driver errors append the query parameters on later lines of `message`; those
 * can hold token hashes or addresses, which must not reach the logs. The
 * database's own reason ("relation … does not exist") sits in `cause` and is
 * what makes a failure diagnosable, so its first line is kept.
 */
function describeError(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? ` (${firstLine(error.cause)})` : "";
  return `${firstLine(error)}${cause}`.slice(0, 300);
}

/**
 * Runs every task, one after another. A failing task is recorded and the rest
 * still run: undelivered reminder mail must not keep a year-old IP address in
 * the database.
 */
export async function runDailyHousekeeping(
  now: Date = new Date(),
  tasks: readonly HousekeepingTask[] = DAILY_TASKS,
): Promise<TaskOutcome[]> {
  const outcomes: TaskOutcome[] = [];
  for (const task of tasks) {
    try {
      outcomes.push({ name: task.name, ok: true, result: await task.run(now) });
    } catch (error) {
      const message = describeError(error);
      console.error(`[housekeeping] ${task.name} failed: ${message}`);
      outcomes.push({ name: task.name, ok: false, error: message });
    }
  }
  return outcomes;
}
