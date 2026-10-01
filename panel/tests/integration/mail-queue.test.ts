/**
 * The e-mail outbox (D-269): every message is stored before it is sent, a
 * failure is retried with growing gaps and then left visible as failed, a mail
 * problem never undoes the change it announces, two runs never send one job
 * twice, and a bulk send returns before a single message has gone out.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { mailJobs, users } from "@/db/schema";
import { setBackgroundRunner, type BackgroundTask } from "@/lib/background";
import { MailConfigError } from "@/lib/mail/config";
import {
  createFileAdapter,
  MemoryMailAdapter,
  setMailAdapter,
  type MailAdapter,
  type MailMessage,
} from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import {
  enqueueMails,
  MAIL_MAX_ATTEMPTS,
  mailQueueOverview,
  processMailQueue,
  pruneMailJobs,
  queueMails,
  retryMailJob,
  sendMail,
} from "@/services/mail-queue";
import { createAnnouncement, publishAnnouncement } from "@/services/announcements";
import { register, verifyEmail } from "@/services/auth";
import { promoteToWriter } from "@/services/users";
import * as templates from "@emails/templates";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

/** Fails the way nodemailer does, a set number of times or forever. */
class FailingAdapter implements MailAdapter {
  readonly name = "failing";
  calls = 0;
  constructor(
    private readonly error: () => Error,
    private failures = Number.POSITIVE_INFINITY,
  ) {}

  async send(message: MailMessage): Promise<void> {
    this.calls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      throw this.error();
    }
    await mailbox.send(message);
  }
}

function smtpError(message: string, responseCode?: number, code?: string): Error {
  return Object.assign(new Error(message), { responseCode, code });
}

/** Takes its time, like a real server, so two runs genuinely overlap. */
class SlowAdapter implements MailAdapter {
  readonly name = "slow";
  readonly sent: string[] = [];
  async send(message: MailMessage): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25));
    this.sent.push(message.to);
  }
}

async function jobsFor(recipient: string) {
  return db.select().from(mailJobs).where(eq(mailJobs.recipient, recipient));
}

async function onlyJob(recipient: string) {
  const rows = await jobsFor(recipient);
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

const sample = () => templates.kvkkNewVersion({ displayName: "Ada", version: 2, url: "https://example.com/kvkk" });

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
  setMailAdapter(mailbox);
});

afterEach(() => {
  setBackgroundRunner(null);
});

describe("delivery through the outbox", () => {
  it("still lands in the memory adapter, with both parts, and is marked sent", async () => {
    await sendMail({ to: "okur@example.com", ...sample() });

    const delivered = mailbox.lastTo("okur@example.com");
    expect(delivered?.text).toContain("aydınlatma metnimizin");
    expect(delivered?.html).toContain("<!DOCTYPE html>");

    const job = await onlyJob("okur@example.com");
    expect(job.status).toBe("sent");
    expect(job.kind).toBe("kvkk_new_version");
    expect(job.attempts).toBe(1);
    expect(job.sentAt).not.toBeNull();
    // Delivered bodies are not kept
    expect(job.textBody).toBeNull();
    expect(job.htmlBody).toBeNull();
    expect(job.purgedAt).not.toBeNull();
  });

  it("still writes the file transport's JSON, now with the HTML part", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "postscript-mail-"));
    try {
      setMailAdapter(createFileAdapter(directory));
      await sendMail({ to: "dosya@example.com", ...sample() });

      const [name] = await readdir(directory);
      const written = JSON.parse(await readFile(path.join(directory, name!), "utf8")) as {
        to: string;
        text: string;
        html: string;
      };
      expect(written.to).toBe("dosya@example.com");
      expect(written.text).toContain("https://example.com/kvkk");
      expect(written.html).toContain('href="https://example.com/kvkk"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("carries an attachment through storage and drops it once sent", async () => {
    const pdf = Buffer.from("%PDF-1.7 örnek");
    await sendMail({
      to: "yazar@example.com",
      ...templates.agreementAccepted({ displayName: "Ada", version: 3 }),
      attachments: [{ filename: "postscript-sozlesme-v3.pdf", content: pdf, contentType: "application/pdf" }],
    });

    const delivered = mailbox.lastTo("yazar@example.com");
    expect(delivered?.attachments?.[0]?.filename).toBe("postscript-sozlesme-v3.pdf");
    expect(delivered?.attachments?.[0]?.contentType).toBe("application/pdf");
    expect(delivered?.attachments?.[0]?.content.equals(pdf)).toBe(true);

    const job = await onlyJob("yazar@example.com");
    expect(job.attachments).toBeNull();
  });
});

describe("retries", () => {
  it("keeps a temporarily failed message and tries again after a minute", async () => {
    const failing = new FailingAdapter(
      () => smtpError("421 Too many requests for okur@example.com, see https://resend.com/x?t=1", 421),
      1,
    );
    setMailAdapter(failing);

    const before = Date.now();
    await sendMail({ to: "okur@example.com", ...sample() });

    let job = await onlyJob("okur@example.com");
    expect(job.status).toBe("pending");
    expect(job.attempts).toBe(1);
    expect(job.textBody).not.toBeNull();
    expect(job.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    // The stored reason names neither the address nor the link
    expect(job.lastError).toContain("421");
    expect(job.lastError).not.toContain("okur@example.com");
    expect(job.lastError).not.toContain("resend.com");

    // Not yet due: nothing happens
    expect((await processMailQueue()).sent).toBe(0);

    const later = new Date(Date.now() + 61_000);
    const result = await processMailQueue({ clock: () => later });
    expect(result.sent).toBe(1);

    job = await onlyJob("okur@example.com");
    expect(job.status).toBe("sent");
    expect(job.attempts).toBe(2);
    expect(mailbox.lastTo("okur@example.com")).toBeDefined();
  });

  it("gives up after the last attempt and leaves the job visible as failed", async () => {
    const failing = new FailingAdapter(() => smtpError("Connection timeout", undefined, "ETIMEDOUT"));
    setMailAdapter(failing);

    await sendMail({ to: "okur@example.com", ...sample() });

    // Each run is nine hours on, past the longest gap
    let now = Date.now();
    for (let run = 0; run < MAIL_MAX_ATTEMPTS + 2; run += 1) {
      now += 9 * 3_600_000;
      const at = new Date(now);
      await processMailQueue({ clock: () => at });
    }

    expect(failing.calls).toBe(MAIL_MAX_ATTEMPTS);
    const job = await onlyJob("okur@example.com");
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(MAIL_MAX_ATTEMPTS);
    expect(job.failedAt).not.toBeNull();
    expect(job.lastError).toContain("ETIMEDOUT");
    // Not a sign-in link, so the body stays for an admin retry
    expect(job.textBody).not.toBeNull();
  });

  it("stops at once when the server refuses the address itself", async () => {
    setMailAdapter(new FailingAdapter(() => smtpError("550 Mailbox unavailable", 550)));
    await sendMail({ to: "yok@example.com", ...sample() });

    const job = await onlyJob("yok@example.com");
    expect(job.status).toBe("failed");
    expect(job.attempts).toBe(1);
  });

  it("keeps retrying while the settings are wrong, so a fix takes effect", async () => {
    setMailAdapter(new FailingAdapter(() => new MailConfigError(["MAIL_FROM yerel."])));
    await sendMail({ to: "okur@example.com", ...sample() });

    const job = await onlyJob("okur@example.com");
    expect(job.status).toBe("pending");
    expect(job.lastError).toContain("MAIL_FROM");
  });

  it("does not send a sign-in link after it has expired", async () => {
    await enqueueMails([
      {
        to: "gec@example.com",
        ...templates.resetPassword({ displayName: "Ada", url: "https://example.com/reset-password?token=x" }),
        expiresAt: new Date(Date.now() - 1000),
      },
    ]);

    const result = await processMailQueue();
    expect(result.failed).toBe(1);
    expect(mailbox.outbox).toHaveLength(0);

    const job = await onlyJob("gec@example.com");
    expect(job.status).toBe("failed");
    expect(job.textBody).toBeNull();
  });
});

describe("the change a mail announces", () => {
  it("is kept when the mail server is down", async () => {
    setMailAdapter(new FailingAdapter(() => smtpError("Connection refused", undefined, "ECONNREFUSED")));
    const admin = await createUser({ role: "admin" });
    const candidate = await createUser({ email: "aday@example.com" });

    const promoted = await promoteToWriter(actorOf(admin), candidate.id, noMeta);

    expect(promoted.role).toBe("writer");
    const [stored] = await db.select().from(users).where(eq(users.id, candidate.id));
    expect(stored!.role).toBe("writer");

    const job = await onlyJob("aday@example.com");
    expect(job.status).toBe("pending");
    expect(job.kind).toBe("promoted_to_writer");
  });

  it("is kept, and the mail still sent directly, when the outbox itself is missing", async () => {
    await db.execute(sql`alter table mail_jobs rename to mail_jobs_hidden`);
    try {
      await expect(sendMail({ to: "okur@example.com", ...sample() })).resolves.toBeUndefined();
      expect(mailbox.lastTo("okur@example.com")?.html).toContain("<!DOCTYPE html>");
    } finally {
      await db.execute(sql`alter table mail_jobs_hidden rename to mail_jobs`);
    }
  });
});

describe("concurrency", () => {
  it("never sends one job twice when two runs overlap", async () => {
    const slow = new SlowAdapter();
    setMailAdapter(slow);
    const recipients = ["a", "b", "c", "d", "e", "f"].map((name) => `${name}@example.com`);
    await enqueueMails(recipients.map((to) => ({ to, ...sample() })));

    const [first, second] = await Promise.all([processMailQueue(), processMailQueue()]);

    expect(first.sent + second.sent).toBe(recipients.length);
    expect([...slow.sent].sort()).toEqual(recipients);
    const rows = await db.select().from(mailJobs);
    expect(rows.every((row) => row.status === "sent" && row.attempts === 1)).toBe(true);
  });

  it("refuses a second job with the same key", async () => {
    const mail = { to: "okur@example.com", ...sample(), dedupeKey: "kvkk:2:okur" };
    expect(await queueMails([mail])).toBe(1);
    expect(await queueMails([mail])).toBe(0);
    expect(await jobsFor("okur@example.com")).toHaveLength(1);
  });
});

describe("bulk sends", () => {
  it("return before any message is sent, and deliver in the background", async () => {
    const deferred: BackgroundTask[] = [];
    setBackgroundRunner(async (task) => {
      deferred.push(task);
    });
    const slow = new SlowAdapter();
    setMailAdapter(slow);

    const editor = await createUser({ role: "editor" });
    const admin = await createUser({ role: "admin" });
    for (let index = 0; index < 5; index += 1) {
      await createUser({ role: "writer", writerStatus: "active", email: `yazar${index}@example.com` });
    }

    const draft = await createAnnouncement(
      actorOf(editor),
      {
        title: "Sayı toplantısı",
        bodyMarkdown: "Cuma günü toplanıyoruz.",
        audience: "writers",
        severity: "important",
        requiresAcknowledgement: true,
        pinned: false,
      },
      noMeta,
    );
    const published = await publishAnnouncement(actorOf(admin), draft.id, noMeta);
    expect(published.publishedAt).not.toBeNull();

    // The admin's request is over: nothing has been handed to the mail server yet
    expect(slow.sent).toHaveLength(0);
    const queued = await db.select().from(mailJobs);
    expect(queued).toHaveLength(5);
    expect(queued.every((row) => row.status === "pending")).toBe(true);
    expect(queued.every((row) => row.dedupeKey?.startsWith(`announcement:${draft.id}:`))).toBe(true);

    for (const task of deferred) await task();

    expect(slow.sent).toHaveLength(5);
    const after = await db.select().from(mailJobs);
    expect(after.every((row) => row.status === "sent")).toBe(true);
  });
});

describe("sign-in links", () => {
  it("still verify an account, and are not kept once sent", async () => {
    const { email } = await register(
      {
        email: "yeni@example.com",
        password: "Cok-Guclu-Sifre-2026",
        displayName: "Yeni Okur",
        birthDate: "1995-05-20",
        kvkkConsent: true,
      },
      noMeta,
    );

    const delivered = mailbox.lastTo(email)!;
    const url = /https?:\/\/\S+verify-email\?token=\S+/.exec(delivered.text)?.[0];
    expect(url).toBeDefined();
    expect(delivered.html).toContain(`href="${url}"`);

    const token = decodeURIComponent(new URL(url!).searchParams.get("token")!);
    const account = await verifyEmail(token, noMeta);
    expect(account.email).toBe(email);

    const job = await onlyJob(email);
    expect(job.sensitive).toBe(true);
    expect(job.textBody).toBeNull();
    expect(job.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });
});

describe("the admin screen", () => {
  it("retries a failed job and refuses one whose body is gone", async () => {
    const admin = actorOf(await createUser({ role: "admin" }));
    setMailAdapter(new FailingAdapter(() => smtpError("550 Mailbox unavailable", 550)));
    await sendMail({ to: "okur@example.com", ...sample() });
    await sendMail({
      to: "gizli@example.com",
      ...templates.resetPassword({ displayName: "Ada", url: "https://example.com/reset-password?token=y" }),
    });

    const failed = await onlyJob("okur@example.com");
    const sensitive = await onlyJob("gizli@example.com");
    expect(sensitive.status).toBe("failed");
    expect(sensitive.textBody).toBeNull();

    setMailAdapter(mailbox);
    await retryMailJob(admin, failed.id, noMeta);
    expect((await onlyJob("okur@example.com")).status).toBe("sent");
    expect(mailbox.lastTo("okur@example.com")).toBeDefined();

    const refused = await captureError(retryMailJob(admin, sensitive.id, noMeta));
    expect(refused.status).toBe(409);

    const overview = await mailQueueOverview(admin, "all");
    expect(overview.totals.sent).toBe(1);
    expect(overview.totals.failed).toBe(1);
  });

  it("is closed to everyone but admins", async () => {
    const editor = actorOf(await createUser({ role: "editor", editorStatus: "active" }));
    const error = await captureError(mailQueueOverview(editor));
    expect(error.status).toBe(403);
  });
});

describe("retention", () => {
  it("deletes finished jobs after 30 days and keeps waiting ones", async () => {
    await sendMail({ to: "eski@example.com", ...sample() });
    setMailAdapter(new FailingAdapter(() => smtpError("timeout", undefined, "ETIMEDOUT")));
    await sendMail({ to: "bekleyen@example.com", ...sample() });

    expect(await pruneMailJobs(new Date(Date.now() + 29 * 86_400_000))).toBe(0);
    expect(await pruneMailJobs(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    expect(await jobsFor("eski@example.com")).toHaveLength(0);
    expect(await jobsFor("bekleyen@example.com")).toHaveLength(1);
  });
});

describe("drafts waiting to be sent (D-293)", () => {
  it("counts the waiting messages by template and shows each as it will be sent, attachments by name", async () => {
    const admin = actorOf(await createUser({ role: "admin" }));
    const { pendingMailDrafts, previewMailJob } = await import("@/services/mail-queue");
    const [id] = await enqueueMails([
      {
        to: "yazar@example.com",
        ...templates.contributorDocumentsSent({ displayName: "Ada", documents: ["Genel Katkı Sağlayan Sözleşmesi"], url: "https://example.com/account" }),
        attachments: [{ filename: "sozlesme.pdf", content: Buffer.from("%PDF-1.4 x"), contentType: "application/pdf" }],
      },
    ]);
    await enqueueMails([
      { to: "gizli@example.com", ...templates.resetPassword({ displayName: "Ada", url: "https://example.com/reset-password?token=y" }), sensitive: true },
    ]);

    const drafts = await pendingMailDrafts(admin);
    expect(drafts.map((row) => [row.kind, row.total])).toEqual([
      ["contributor_documents", 1],
      ["reset_password", 1],
    ]);

    const preview = await previewMailJob(admin, id!);
    expect(preview.recipient).toBe("yazar@example.com");
    expect(preview.html).toContain("Belgeleriniz ektedir");
    expect(preview.text).toContain("Genel Katkı Sağlayan Sözleşmesi");
    expect(preview.attachments).toEqual([{ filename: "sozlesme.pdf", contentType: "application/pdf", bytes: expect.any(Number) }]);
    // Nothing was sent by looking
    expect((await db.select().from(mailJobs).where(eq(mailJobs.id, id!)))[0]!.status).toBe("pending");
  });

  it("keeps a sign-in or reset link out of view, and the page closed to all but admins", async () => {
    const admin = actorOf(await createUser({ role: "admin" }));
    const { previewMailJob } = await import("@/services/mail-queue");
    const [id] = await enqueueMails([
      { to: "gizli@example.com", ...templates.resetPassword({ displayName: "Ada", url: "https://example.com/reset-password?token=y" }), sensitive: true },
    ]);
    const preview = await previewMailJob(admin, id!);
    expect(preview.html).toBeNull();
    expect(preview.text).toBeNull();
    expect(preview.hidden).toMatch(/gösterilmez/);

    const editor = actorOf(await createUser({ role: "editor", editorStatus: "active" }));
    expect((await captureError(previewMailJob(editor, id!))).status).toBe(403);
    expect((await captureError(previewMailJob(admin, "not-a-uuid"))).status).toBe(404);
  });
});
