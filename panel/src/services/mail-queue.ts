/**
 * The e-mail outbox (D-269).
 *
 * Every message is first written to `mail_jobs`, then delivered. A delivery
 * failure leaves the row behind with a later `next_attempt_at` instead of
 * losing the message, and nothing here ever throws back into the service that
 * asked for the mail: the promotion, signature or publication it announces has
 * already happened and must not be undone by a mail server.
 *
 * Delivery runs without a long-lived worker, because Vercel has none:
 *  - right after the response, through `after()` (`runInBackground`), for the
 *    message just queued plus a few jobs that are due for a retry;
 *  - in the daily cron run and on `/api/cron/mail`;
 *  - when an admin presses "Kuyruğu şimdi işle".
 *
 * A job is claimed with a compare-and-set update, so two runs that see the
 * same job cannot both send it. A run that dies mid-send leaves the job
 * `processing` until its lock lapses; only then is it picked up again.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mailJobs, type MailJob, type MailJobStatus, type StoredMailAttachment } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageMailQueue, type Actor } from "@/lib/auth/rbac";
import { runInBackground } from "@/lib/background";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { MailConfigError } from "@/lib/mail/config";
import { deliverMail, getMailAdapter, type MailMessage } from "@/lib/mail/transport";
import type { RequestMeta } from "@/services/auth";

/* ------------------------------------------------------------------ */
/* Policy                                                              */
/* ------------------------------------------------------------------ */

export const MAIL_MAX_ATTEMPTS = 6;

/**
 * Wait after the n-th failed attempt: 1 min, 5 min, 30 min, 2 h, 8 h. A short
 * outage is covered within minutes, a day-long one still gets a try the next
 * morning, and the sixth failure ends it — about 11 hours of trying in all.
 */
export const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 28_800_000] as const;

/** How long a claimed job stays ours; a run cut off by the platform frees it after this. */
export const MAIL_LOCK_MS = 10 * 60_000;

/** Resend accepts two requests a second per team; stay under it when sending in a row. */
const SMTP_SEND_INTERVAL_MS = 600;

/** Bulk inserts go in slices so one statement never carries thousands of rows. */
const INSERT_CHUNK = 500;

/** Retries picked up alongside a freshly queued message, so a quiet day still retries. */
const DUE_RETRIES_PER_SEND = 10;

/** Time for delivery after a response; well under the platform's function limit. */
export const BACKGROUND_BUDGET_MS = 45_000;

export function retryDelayMs(attemptsMade: number): number {
  const index = Math.min(Math.max(attemptsMade, 1), RETRY_DELAYS_MS.length) - 1;
  return RETRY_DELAYS_MS[index]!;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Error text safe to store and log: first line only, addresses and links
 * replaced, at most 300 characters. SMTP replies quote the recipient, and a
 * link in a reply could be a sign-in token.
 */
export function describeMailError(error: unknown): string {
  const details = error as { code?: unknown; responseCode?: unknown } | null;
  const prefix = [
    typeof details?.code === "string" ? details.code : null,
    typeof details?.responseCode === "number" ? String(details.responseCode) : null,
  ]
    .filter(Boolean)
    .join(" ");
  const message = (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";
  const cleaned = message
    .replace(/https?:\/\/\S+/gi, "[bağlantı]")
    .replace(/[^\s<>"'@]+@[^\s<>"'@]+/g, "[adres]");
  return (prefix ? `${prefix}: ${cleaned}` : cleaned).slice(0, 300);
}

/**
 * A failure that another attempt cannot fix: the server refused the address
 * itself. Everything else — timeouts, rate limits, a wrong setting that an
 * admin can correct — is worth retrying.
 */
export function isPermanentMailError(error: unknown): boolean {
  if (error instanceof MailConfigError) return false;
  const details = error as { code?: unknown; responseCode?: unknown } | null;
  if (details?.code === "EENVELOPE") return true;
  return typeof details?.responseCode === "number" && [501, 550, 551, 553].includes(details.responseCode);
}

/* ------------------------------------------------------------------ */
/* Queueing                                                            */
/* ------------------------------------------------------------------ */

/** A rendered message plus what the queue needs to handle it. */
export type OutgoingMail = MailMessage & {
  /** The template's name, for the admin list; the queue itself never reads it. */
  kind?: string;
  /** Carries a sign-in, verification or reset link: body is dropped as soon as it is done with. */
  sensitive?: boolean;
  /** A link that stops working at this time is not worth sending after it. */
  expiresAt?: Date;
  /** Refuses a second job with the same key, e.g. one announcement to one member. */
  dedupeKey?: string;
};

function toRow(mail: OutgoingMail) {
  return {
    kind: mail.kind ?? "custom",
    recipient: mail.to,
    subject: mail.subject,
    textBody: mail.text,
    htmlBody: mail.html ?? null,
    attachments:
      mail.attachments?.map(
        (a): StoredMailAttachment => ({
          filename: a.filename,
          contentType: a.contentType,
          contentBase64: a.content.toString("base64"),
        }),
      ) ?? null,
    sensitive: mail.sensitive ?? false,
    expiresAt: mail.expiresAt ?? null,
    dedupeKey: mail.dedupeKey ?? null,
    maxAttempts: MAIL_MAX_ATTEMPTS,
    // The app's clock, not the database's: the run right after this compares
    // against the app's clock, and a skew of milliseconds would skip the job
    nextAttemptAt: new Date(),
  };
}

/** Stores the messages. Returns the ids of the rows written; a duplicate key writes none. */
export async function enqueueMails(mails: OutgoingMail[]): Promise<string[]> {
  const ids: string[] = [];
  for (let start = 0; start < mails.length; start += INSERT_CHUNK) {
    const rows = await db
      .insert(mailJobs)
      .values(mails.slice(start, start + INSERT_CHUNK).map(toRow))
      .onConflictDoNothing({ target: mailJobs.dedupeKey })
      .returning({ id: mailJobs.id });
    ids.push(...rows.map((row) => row.id));
  }
  return ids;
}

/** Last resort when the outbox itself cannot be written: the old direct send, logged. */
async function deliverWithoutQueue(mail: OutgoingMail): Promise<void> {
  try {
    await deliverMail(mail);
  } catch (error) {
    console.error(`Mail delivery failed (${mail.kind ?? "custom"}, no queue): ${describeMailError(error)}`);
  }
}

/**
 * Queues one message and delivers it after the response. Never throws.
 *
 * If the outbox cannot be written — for example the code reached production
 * before its migration — the message is sent directly as before, so a missing
 * table costs the retry, not the mail.
 */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  let ids: string[];
  try {
    ids = await enqueueMails([mail]);
  } catch (error) {
    console.error(`Mail queue unavailable (${mail.kind ?? "custom"}): ${describeMailError(error)}`);
    await runInBackground(() => deliverWithoutQueue(mail));
    return;
  }
  if (ids.length === 0) return;

  await runInBackground(async () => {
    await processMailQueue({ ids, alsoDue: DUE_RETRIES_PER_SEND, budgetMs: BACKGROUND_BUDGET_MS });
  });
}

/**
 * Queues many messages at once — an announcement, a notice to every member —
 * and returns as soon as they are stored. Delivery starts after the response
 * and continues in later runs for whatever did not fit in the time budget.
 * Never throws; returns how many new jobs were written.
 */
export async function queueMails(mails: OutgoingMail[]): Promise<number> {
  if (mails.length === 0) return 0;

  let ids: string[];
  try {
    ids = await enqueueMails(mails);
  } catch (error) {
    console.error(`Mail queue unavailable for ${mails.length} messages: ${describeMailError(error)}`);
    await runInBackground(async () => {
      for (const mail of mails) await deliverWithoutQueue(mail);
    });
    return 0;
  }

  if (ids.length > 0) {
    await runInBackground(async () => {
      await processMailQueue({ budgetMs: BACKGROUND_BUDGET_MS, limit: ids.length + DUE_RETRIES_PER_SEND });
    });
  }
  return ids.length;
}

/* ------------------------------------------------------------------ */
/* Processing                                                          */
/* ------------------------------------------------------------------ */

export type ProcessOptions = {
  /** Only these jobs (plus `alsoDue` others); otherwise every due job, oldest first. */
  ids?: string[];
  alsoDue?: number;
  limit?: number;
  budgetMs?: number;
  clock?: () => Date;
};

export type ProcessResult = { sent: number; retrying: number; failed: number; skipped: number };

/** Due: waiting and its time has come, or claimed by a run whose lock has lapsed. */
function dueCondition(now: Date) {
  return or(
    and(eq(mailJobs.status, "pending"), lte(mailJobs.nextAttemptAt, now)),
    and(eq(mailJobs.status, "processing"), lt(mailJobs.lockedUntil, now)),
  );
}

async function dueIds(now: Date, limit: number, except: string[] = []): Promise<string[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select({ id: mailJobs.id })
    .from(mailJobs)
    .where(dueCondition(now))
    .orderBy(asc(mailJobs.nextAttemptAt))
    .limit(limit + except.length);
  return rows.map((row) => row.id).filter((id) => !except.includes(id)).slice(0, limit);
}

/**
 * Takes the job if nobody else has. The `where` repeats the due check, so of
 * two runs racing for the same row exactly one gets it back.
 */
async function claim(id: string, now: Date): Promise<MailJob | null> {
  const [claimed] = await db
    .update(mailJobs)
    .set({
      status: "processing",
      attempts: sql`${mailJobs.attempts} + 1`,
      lastAttemptAt: now,
      lockedUntil: new Date(now.getTime() + MAIL_LOCK_MS),
      updatedAt: now,
    })
    .where(and(eq(mailJobs.id, id), dueCondition(now)))
    .returning();
  return claimed ?? null;
}

/** The body is removed; subject, recipient and timing stay for the admin list. */
const PURGED = { textBody: null, htmlBody: null, attachments: null } as const;

/** Writes the outcome only if the job is still the one we claimed. */
async function settle(job: MailJob, values: Partial<typeof mailJobs.$inferInsert>): Promise<void> {
  await db
    .update(mailJobs)
    .set({ ...values, lockedUntil: null, updatedAt: new Date() })
    .where(
      and(eq(mailJobs.id, job.id), eq(mailJobs.status, "processing"), eq(mailJobs.attempts, job.attempts)),
    );
}

function fromRow(job: MailJob): MailMessage {
  return {
    to: job.recipient,
    subject: job.subject,
    text: job.textBody ?? "",
    html: job.htmlBody ?? undefined,
    attachments: job.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: Buffer.from(a.contentBase64, "base64"),
    })),
  };
}

type Outcome = "sent" | "retrying" | "failed";

async function attempt(job: MailJob, now: Date): Promise<Outcome> {
  if (job.expiresAt && job.expiresAt <= now) {
    await settle(job, {
      ...PURGED,
      status: "failed",
      failedAt: now,
      purgedAt: now,
      lastError: "Bağlantının süresi dolduğu için gönderilmedi.",
    });
    return "failed";
  }
  if (job.textBody === null) {
    await settle(job, { status: "failed", failedAt: now, lastError: "İleti içeriği silinmiş." });
    return "failed";
  }

  try {
    await deliverMail(fromRow(job));
  } catch (error) {
    const reason = describeMailError(error);
    console.error(`Mail job ${job.id} (${job.kind}) attempt ${job.attempts}/${job.maxAttempts} failed: ${reason}`);

    if (isPermanentMailError(error) || job.attempts >= job.maxAttempts) {
      await settle(job, {
        ...(job.sensitive ? PURGED : {}),
        ...(job.sensitive ? { purgedAt: now } : {}),
        status: "failed",
        failedAt: now,
        lastError: reason,
      });
      return "failed";
    }

    await settle(job, {
      status: "pending",
      nextAttemptAt: new Date(now.getTime() + retryDelayMs(job.attempts)),
      lastError: reason,
    });
    return "retrying";
  }

  // Delivered: the body has done its job and is not kept (KVKK notice §7)
  await settle(job, { ...PURGED, status: "sent", sentAt: now, purgedAt: now, lastError: null });
  return "sent";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Delivers due jobs until the list or the time budget runs out. Never throws. */
export async function processMailQueue(options: ProcessOptions = {}): Promise<ProcessResult> {
  const clock = options.clock ?? (() => new Date());
  const startedAt = Date.now();
  const budget = options.budgetMs ?? BACKGROUND_BUDGET_MS;
  const result: ProcessResult = { sent: 0, retrying: 0, failed: 0, skipped: 0 };

  try {
    const now = clock();
    const ids = options.ids
      ? [...options.ids, ...(await dueIds(now, options.alsoDue ?? 0, options.ids))]
      : await dueIds(now, options.limit ?? 200);

    const throttle = getMailAdapter().name === "smtp";
    let sentBefore = false;

    for (const id of ids) {
      if (Date.now() - startedAt > budget) {
        result.skipped += 1;
        continue;
      }
      const job = await claim(id, clock());
      if (!job) {
        result.skipped += 1;
        continue;
      }
      if (throttle && sentBefore) await sleep(SMTP_SEND_INTERVAL_MS);
      sentBefore = true;
      result[await attempt(job, clock())] += 1;
    }
  } catch (error) {
    console.error(`Mail queue run stopped: ${describeMailError(error)}`);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Retention                                                           */
/* ------------------------------------------------------------------ */

/** KVKK notice §7: finished jobs (subject, address, times) are kept 30 days. */
export const MAIL_JOB_RETENTION_DAYS = 30;

export async function pruneMailJobs(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - MAIL_JOB_RETENTION_DAYS * 86_400_000);
  const removed = await db
    .delete(mailJobs)
    .where(
      or(
        and(eq(mailJobs.status, "sent"), lt(mailJobs.sentAt, cutoff)),
        and(eq(mailJobs.status, "failed"), lt(mailJobs.failedAt, cutoff)),
      ),
    )
    .returning({ id: mailJobs.id });
  return removed.length;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export type MailQueueFilter = "attention" | "sent" | "all";

export async function mailQueueOverview(actor: Actor, filter: MailQueueFilter = "attention") {
  if (!canManageMailQueue(actor)) throw forbidden();

  const counts = await db
    .select({ status: mailJobs.status, total: count() })
    .from(mailJobs)
    .groupBy(mailJobs.status);
  const totals: Record<MailJobStatus, number> = { pending: 0, processing: 0, sent: 0, failed: 0 };
  for (const row of counts) totals[row.status] = Number(row.total);

  const statuses: MailJobStatus[] =
    filter === "attention" ? ["pending", "processing", "failed"] : filter === "sent" ? ["sent"] : [];

  const jobs = await db
    .select({
      id: mailJobs.id,
      kind: mailJobs.kind,
      recipient: mailJobs.recipient,
      subject: mailJobs.subject,
      status: mailJobs.status,
      attempts: mailJobs.attempts,
      maxAttempts: mailJobs.maxAttempts,
      lastError: mailJobs.lastError,
      nextAttemptAt: mailJobs.nextAttemptAt,
      lastAttemptAt: mailJobs.lastAttemptAt,
      sentAt: mailJobs.sentAt,
      failedAt: mailJobs.failedAt,
      createdAt: mailJobs.createdAt,
      purged: sql<boolean>`${mailJobs.purgedAt} is not null`,
    })
    .from(mailJobs)
    .where(statuses.length > 0 ? inArray(mailJobs.status, statuses) : undefined)
    .orderBy(desc(mailJobs.createdAt))
    .limit(100);

  return { totals, jobs };
}

/** Puts a failed job back at the front of the queue with a fresh set of attempts. */
export async function retryMailJob(actor: Actor, jobId: string, meta: RequestMeta): Promise<void> {
  if (!canManageMailQueue(actor)) throw forbidden();
  if (!z.uuid().safeParse(jobId).success) throw badRequest("Geçersiz e-posta kaydı.");

  const [job] = await db.select().from(mailJobs).where(eq(mailJobs.id, jobId)).limit(1);
  if (!job) throw notFound("E-posta kaydı bulunamadı.");
  if (job.status !== "failed") throw conflict("Yalnızca başarısız olan bir e-posta yeniden denenebilir.");
  if (job.textBody === null) {
    throw conflict("Bu iletinin içeriği silinmiş; yeniden gönderilemez. Kullanıcı yeni bağlantı istemeli.");
  }

  const now = new Date();
  const [reset] = await db
    .update(mailJobs)
    .set({ status: "pending", attempts: 0, nextAttemptAt: now, failedAt: null, updatedAt: now })
    .where(and(eq(mailJobs.id, jobId), eq(mailJobs.status, "failed"), isNull(mailJobs.purgedAt)))
    .returning({ id: mailJobs.id });
  if (!reset) throw conflict("E-posta kaydı bu arada değişti; sayfayı yenileyin.");

  await writeAudit({
    actorId: actor.id,
    action: "mail.retry",
    entityType: "mail_jobs",
    entityId: jobId,
    after: { kind: job.kind },
    ip: meta.ip,
  });

  await runInBackground(async () => {
    await processMailQueue({ ids: [jobId], budgetMs: BACKGROUND_BUDGET_MS });
  });
}

/** The admin's "process now": runs in the request so the result can be shown. */
export async function processMailQueueAsAdmin(actor: Actor): Promise<ProcessResult> {
  if (!canManageMailQueue(actor)) throw forbidden();
  return processMailQueue({ budgetMs: 240_000, limit: 500 });
}

/* ------------------------------------------------------------------ */
/* Drafts: what is waiting to go (D-293)                               */
/* ------------------------------------------------------------------ */

/** The messages still waiting to be sent, counted by template. */
export async function pendingMailDrafts(actor: Actor): Promise<{ kind: string; total: number; oldest: Date }[]> {
  if (!canManageMailQueue(actor)) throw forbidden();
  const rows = await db
    .select({ kind: mailJobs.kind, total: count(), oldest: sql<Date>`min(${mailJobs.createdAt})` })
    .from(mailJobs)
    .where(eq(mailJobs.status, "pending"))
    .groupBy(mailJobs.kind)
    .orderBy(asc(mailJobs.kind));
  return rows.map((row) => ({ kind: row.kind, total: Number(row.total), oldest: new Date(row.oldest) }));
}

export type MailJobPreview = {
  id: string;
  kind: string;
  recipient: string;
  subject: string;
  status: MailJobStatus;
  createdAt: Date;
  /** Null when the body was dropped after sending, or is kept from view. */
  html: string | null;
  text: string | null;
  /** Why the body is not shown, when it is not. */
  hidden: string | null;
  attachments: { filename: string; contentType: string; bytes: number }[];
};

/**
 * One message as it will be sent, for the admin to read before sending
 * (D-293). A message carrying a sign-in, verification or reset link is not
 * shown: its link would work for whoever reads it.
 */
export async function previewMailJob(actor: Actor, jobId: string): Promise<MailJobPreview> {
  if (!canManageMailQueue(actor)) throw forbidden();
  if (!z.uuid().safeParse(jobId).success) throw notFound("E-posta kaydı bulunamadı.");
  const [job] = await db.select().from(mailJobs).where(eq(mailJobs.id, jobId)).limit(1);
  if (!job) throw notFound("E-posta kaydı bulunamadı.");

  const hidden = job.sensitive
    ? "Bu ileti giriş, doğrulama ya da şifre bağlantısı taşıdığı için içeriği gösterilmez."
    : job.textBody === null
      ? "Gönderildiği için içeriği silindi."
      : null;
  return {
    id: job.id,
    kind: job.kind,
    recipient: job.recipient,
    subject: job.subject,
    status: job.status,
    createdAt: job.createdAt,
    html: hidden ? null : job.htmlBody,
    text: hidden ? null : job.textBody,
    hidden,
    attachments: (job.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType ?? "application/octet-stream",
      bytes: Math.floor((a.contentBase64.length * 3) / 4),
    })),
  };
}
