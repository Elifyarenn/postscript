/**
 * How mail goes out while CRON_SECRET is not set (D-317), as on production
 * today. Both cron routes stay closed; the admin's "Kuyruğu şimdi işle" and an
 * ordinary send deliver what is queued, and neither runs any of the daily
 * deletions: old mail rows, an unverified account past its grace period and an
 * expired pending sign-up are all still there afterwards. Mail goes to the
 * in-memory adapter; nothing real is sent.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { mailJobs, pendingRegistrations, users } from "@/db/schema";
import { resetEnvCache } from "@/lib/env";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { enqueueMails, processMailQueueAsAdmin, sendMail } from "@/services/mail-queue";
import { GET as cronDaily } from "@/app/api/cron/daily/route";
import { GET as cronMail } from "@/app/api/cron/mail/route";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();
let savedSecret: string | undefined;

beforeAll(async () => {
  database = await setupTestDatabase();
  savedSecret = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  resetEnvCache();
});
afterAll(async () => {
  if (savedSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedSecret;
  resetEnvCache();
  await teardownTestDatabase();
});
beforeEach(async () => {
  await resetTables(database);
  mailbox.outbox.length = 0;
  setMailAdapter(mailbox);
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

/** Everything the daily run would remove today. */
async function dueForDeletion() {
  const [oldSent] = await db
    .insert(mailJobs)
    .values({ kind: "custom", recipient: "eski@example.com", subject: "Eski", textBody: null, status: "sent", sentAt: daysAgo(40) })
    .returning({ id: mailJobs.id });
  const [oldFailed] = await db
    .insert(mailJobs)
    .values({ kind: "custom", recipient: "eski@example.com", subject: "Eski", textBody: null, status: "failed", failedAt: daysAgo(40) })
    .returning({ id: mailJobs.id });
  const unverified = await createUser({ emailVerified: false });
  await db.update(users).set({ createdAt: daysAgo(10) }).where(eq(users.id, unverified.id));
  const [pending] = await db
    .insert(pendingRegistrations)
    .values({
      email: "bekleyen@example.com",
      passwordHash: "x",
      displayName: "Bekleyen",
      birthDate: "2000-01-01",
      kvkkConsentVersion: 1,
      tokenHash: "t".repeat(64),
      expiresAt: daysAgo(1),
    })
    .returning({ id: pendingRegistrations.id });
  return { oldSent: oldSent!.id, oldFailed: oldFailed!.id, unverified, pending: pending!.id };
}

async function expectNothingDeleted(due: Awaited<ReturnType<typeof dueForDeletion>>) {
  const jobs = (await db.select({ id: mailJobs.id }).from(mailJobs)).map((row) => row.id);
  expect(jobs).toContain(due.oldSent);
  expect(jobs).toContain(due.oldFailed);
  const [account] = await db.select().from(users).where(eq(users.id, due.unverified.id));
  // It really is what the daily run would anonymise: never verified, past the grace period
  expect(account!.emailVerifiedAt).toBeNull();
  expect(account!.deletedAt).toBeNull();
  expect(account!.email).toBe(due.unverified.email);
  expect(await db.select().from(pendingRegistrations).where(eq(pendingRegistrations.id, due.pending))).toHaveLength(1);
}

const bearer = () => new Request("https://example.test/api/cron", { headers: { authorization: "Bearer anything-at-all" } });

describe("mail while CRON_SECRET is not set (D-317)", () => {
  it("keeps both cron routes closed, so nothing is delivered or deleted by them", async () => {
    const due = await dueForDeletion();
    await enqueueMails([{ to: "okur@example.com", subject: "Belgeleriniz", text: "Ekte.", kind: "contributor_documents" }]);

    expect((await cronDaily(bearer())).status).toBe(401);
    expect((await cronMail(bearer())).status).toBe(401);
    expect(mailbox.outbox).toHaveLength(0);
    expect((await db.select().from(mailJobs).where(eq(mailJobs.recipient, "okur@example.com")))[0]!.status).toBe("pending");
    await expectNothingDeleted(due);
  });

  it("delivers the queue from the admin's 'Kuyruğu şimdi işle' without any deletion", async () => {
    const due = await dueForDeletion();
    const admin = actorOf(await createUser({ role: "admin" }));
    await enqueueMails([
      { to: "bir@example.com", subject: "Belgeleriniz", text: "Ekte.", kind: "contributor_documents" },
      { to: "iki@example.com", subject: "Hatırlatma", text: "Yükleyin.", kind: "contributor_upload_reminder" },
    ]);

    const result = await processMailQueueAsAdmin(admin);
    expect(result.sent).toBe(2);
    expect(mailbox.outbox.map((mail) => mail.to).sort()).toEqual(["bir@example.com", "iki@example.com"]);
    await expectNothingDeleted(due);
  });

  it("delivers an ordinary single mail right after the request, without any deletion", async () => {
    const due = await dueForDeletion();
    const jobId = await sendMail({ to: "uc@example.com", subject: "Doğrulama", text: "Bağlantı." });
    expect(jobId).not.toBeNull();
    expect(mailbox.outbox.map((mail) => mail.to)).toContain("uc@example.com");
    await expectNothingDeleted(due);
  });

  it("lets only an admin run the queue", async () => {
    const editor = actorOf(await createUser({ role: "editor" }));
    await expect(processMailQueueAsAdmin(editor)).rejects.toMatchObject({ status: 403 });
  });
});
