/**
 * "Yazı tesliminde son gün" (D-336): in the last 24 hours of a delivery
 * window, each active writer whose accepted topic is not handed in yet is
 * mailed once; a writer already in review or without a topic is not.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issues, notifications, topicProposals } from "@/db/schema";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { remindSubmissionLastDay } from "@/services/issue-mail";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
});

async function issueClosingIn(msLeft: number, extra: { adminOnly?: boolean } = {}) {
  const now = Date.now();
  const [row] = await db
    .insert(issues)
    .values({
      number: 2,
      title: "Gotizm",
      adminOnly: extra.adminOnly ?? false,
      submissionOpensAt: new Date(now - 10 * DAY),
      submissionClosesAt: new Date(now + msLeft),
    })
    .returning();
  return row!;
}

async function writer(email: string) {
  return createUser({ role: "writer", writerStatus: "active", email });
}

async function acceptedTopic(issueId: string, authorId: string, title: string, articleStatus?: "draft" | "in_review") {
  let articleId: string | null = null;
  if (articleStatus) {
    const [article] = await db
      .insert(articles)
      .values({ issueId, authorId, title, slug: title.toLowerCase().replace(/\s+/g, "-"), status: articleStatus })
      .returning();
    articleId = article!.id;
  }
  await db.insert(topicProposals).values({
    issueId,
    authorId,
    title,
    description: "Açıklama",
    status: "accepted",
    articleId,
  });
}

describe("the last-day reminder", () => {
  it("mails writers whose accepted topic is not handed in, once", async () => {
    const issue = await issueClosingIn(20 * HOUR);
    const notStarted = await writer("baslamadi@example.com");
    const drafting = await writer("taslak@example.com");
    const submitted = await writer("gonderdi@example.com");
    await writer("konusuz@example.com");
    await acceptedTopic(issue.id, notStarted.id, "Karanlık mimari");
    await acceptedTopic(issue.id, drafting.id, "Goya", "draft");
    await acceptedTopic(issue.id, submitted.id, "Vampirler", "in_review");

    expect(await remindSubmissionLastDay()).toBe(2);

    const mail = mailbox.lastTo("taslak@example.com");
    expect(mail?.subject).toBe("postscript · Sayı 2 · Gotizm için yazı tesliminde son gün");
    expect(mail?.text).toContain("Kabul edilen konunuz: Goya");
    expect(mail?.text).toContain("/writer/topics");
    expect(mailbox.lastTo("baslamadi@example.com")?.text).toContain("Karanlık mimari");
    expect(mailbox.lastTo("gonderdi@example.com")).toBeUndefined();
    expect(mailbox.lastTo("konusuz@example.com")).toBeUndefined();

    const bells = await db.select().from(notifications).where(eq(notifications.kind, "issue.submission_last_day"));
    expect(bells).toHaveLength(2);

    mailbox.clear();
    expect(await remindSubmissionLastDay()).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("waits for the last 24 hours and stops at the deadline", async () => {
    const issue = await issueClosingIn(2 * DAY);
    const author = await writer("yazar@example.com");
    await acceptedTopic(issue.id, author.id, "Goya");

    expect(await remindSubmissionLastDay()).toBe(0);
    expect(await remindSubmissionLastDay(new Date(Date.now() + 3 * DAY))).toBe(0);
    expect(await remindSubmissionLastDay(new Date(Date.now() + DAY + HOUR))).toBe(1);
  });

  it("leaves the admins' working issue alone", async () => {
    const issue = await issueClosingIn(HOUR, { adminOnly: true });
    const author = await writer("yazar@example.com");
    await acceptedTopic(issue.id, author.id, "Goya");

    expect(await remindSubmissionLastDay()).toBe(0);
  });
});
