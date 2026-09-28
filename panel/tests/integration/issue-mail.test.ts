/**
 * "Yazı kabul dönemi başladı" (D-270): once an issue's delivery window has
 * opened, every active writer is mailed once — with their accepted topic if
 * they have one — and nobody else, and never for the admins' working issue.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { issues, notifications, topicProposals, users } from "@/db/schema";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { announceOpenedIssueWindows, announceOpenedSubmissionWindows } from "@/services/issue-mail";
import { getSiteSettings } from "@/services/site-settings";
import * as templates from "@emails/templates";
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

async function issueOpenedAgo(number: number, openedMsAgo: number, extra: { adminOnly?: boolean } = {}) {
  const now = Date.now();
  const [row] = await db
    .insert(issues)
    .values({
      number,
      title: `Sayı başlığı ${number}`,
      adminOnly: extra.adminOnly ?? false,
      topicOpensAt: new Date(now - 20 * DAY),
      topicClosesAt: new Date(now - 10 * DAY),
      submissionOpensAt: new Date(now - openedMsAgo),
      submissionClosesAt: new Date(now - openedMsAgo + 14 * DAY),
    })
    .returning();
  return row!;
}

async function writer(email: string, overrides: Parameters<typeof createUser>[0] = {}) {
  return createUser({ role: "writer", writerStatus: "active", email, ...overrides });
}

describe("the template", () => {
  it("names the accepted topic, or says only accepted topics may be handed in", () => {
    const base = {
      displayName: "Ada",
      issueLabel: "Sayı 2 · Gotizm",
      closesAt: "15 Ekim 18:00",
      url: "https://example.com/writer/topics",
    };
    const invited = templates.submissionWindowOpened({ ...base, acceptedTopic: "Karanlık mimari" });
    expect(invited.subject).toBe("postscript · Sayı 2 · Gotizm için yazı kabul dönemi başladı");
    expect(invited.text).toContain("Son teslim: 15 Ekim 18:00");
    expect(invited.text).toContain("Kabul edilen konunuz: Karanlık mimari");
    expect(invited.text).toContain("https://example.com/writer/topics");

    const told = templates.submissionWindowOpened({ ...base, acceptedTopic: null });
    expect(told.text).toContain("yalnızca konusu kabul edilmiş yazılar teslim edilebilir");
    expect(told.text).not.toContain("Kabul edilen konunuz");
  });
});

describe("the delivery window opening", () => {
  it("mails and notifies each active writer once, naming an accepted topic", async () => {
    const issue = await issueOpenedAgo(2, HOUR);
    const withTopic = await writer("konulu@example.com");
    await writer("konusuz@example.com");
    await writer("askida@example.com", { writerStatus: "suspended" });
    await writer("yasakli@example.com", { isBanned: true });
    await createUser({ email: "okur@example.com" });
    await db.insert(topicProposals).values({
      issueId: issue.id,
      authorId: withTopic.id,
      title: "Karanlık mimari",
      description: "Gotik katedraller",
      status: "accepted",
    });

    expect(await announceOpenedSubmissionWindows()).toBe(2);

    const invited = mailbox.lastTo("konulu@example.com");
    expect(invited?.subject).toBe("postscript · Sayı 2 · Sayı başlığı 2 için yazı kabul dönemi başladı");
    expect(invited?.text).toContain("Kabul edilen konunuz: Karanlık mimari");
    expect(invited?.text).toContain("/writer/topics");
    expect(mailbox.lastTo("konusuz@example.com")?.text).toContain("yalnızca konusu kabul edilmiş yazılar");

    for (const address of ["askida@example.com", "yasakli@example.com", "okur@example.com"]) {
      expect(mailbox.lastTo(address), address).toBeUndefined();
    }

    const bells = await db
      .select()
      .from(notifications)
      .where(eq(notifications.kind, "issue.submission_opened"));
    expect(bells).toHaveLength(2);

    // A second run — the next dashboard view, the cron — sends nothing more
    mailbox.clear();
    expect(await announceOpenedSubmissionWindows()).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("sends once when two runs meet", async () => {
    await issueOpenedAgo(2, HOUR);
    await writer("yazar@example.com");

    const [first, second] = await Promise.all([
      announceOpenedSubmissionWindows(),
      announceOpenedSubmissionWindows(),
    ]);
    expect(first + second).toBe(1);
    expect(mailbox.outbox).toHaveLength(1);
  });

  it("waits for the opening minute, and announces a moved window again", async () => {
    const issue = await issueOpenedAgo(2, -HOUR);
    await writer("yazar@example.com");

    expect(await announceOpenedSubmissionWindows()).toBe(0);
    // An hour and a minute later the window has opened
    expect(await announceOpenedSubmissionWindows(new Date(Date.now() + HOUR + 60_000))).toBe(1);

    // The admin reopens it with new dates: that is news again
    await db
      .update(issues)
      .set({ submissionOpensAt: new Date(Date.now() - 2 * HOUR), submissionClosesAt: new Date(Date.now() + 7 * DAY) })
      .where(eq(issues.id, issue.id));
    expect(await announceOpenedSubmissionWindows()).toBe(1);
  });

  it("stays quiet for the admins' working issue, an old window and a closed one", async () => {
    await issueOpenedAgo(1, HOUR, { adminOnly: true });
    await issueOpenedAgo(3, 5 * DAY);
    await issueOpenedAgo(4, 15 * DAY);
    await writer("yazar@example.com");

    expect(await announceOpenedSubmissionWindows()).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("leaves the publisher settings untouched", async () => {
    await issueOpenedAgo(2, HOUR);
    await writer("yazar@example.com");
    const before = await getSiteSettings();
    await announceOpenedSubmissionWindows();
    expect(await getSiteSettings()).toEqual(before);
  });
});

describe("the topic window opening (D-272)", () => {
  async function topicIssueOpenedAgo(openedMsAgo: number) {
    const now = Date.now();
    const [row] = await db
      .insert(issues)
      .values({
        number: 2,
        title: "Gotizm",
        theme: "Gotik karanlık",
        topicOpensAt: new Date(now - openedMsAgo),
        topicClosesAt: new Date(now - openedMsAgo + 10 * DAY),
        submissionOpensAt: new Date(now - openedMsAgo + 12 * DAY),
        submissionClosesAt: new Date(now - openedMsAgo + 20 * DAY),
      })
      .returning();
    return row!;
  }

  it("mails and notifies each active writer once, reminding two-area writers of both", async () => {
    await topicIssueOpenedAgo(HOUR);
    const twoAreas = await writer("iki@example.com");
    await db
      .update(users)
      .set({ writerArea: "Sanat & Edebiyat", writerArea2: "Felsefe & Düşünce" })
      .where(eq(users.id, twoAreas.id));
    const oneArea = await writer("tek@example.com");
    await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, oneArea.id));
    await writer("askida@example.com", { writerStatus: "suspended" });

    // Only the topic window is open; the delivery one is days away
    expect(await announceOpenedIssueWindows()).toBe(2);

    const both = mailbox.lastTo("iki@example.com");
    expect(both?.subject).toBe("postscript · Sayı 2 · Gotizm için konu belirleme dönemi başladı");
    expect(both?.text).toContain("Tema: Gotik karanlık");
    expect(both?.text).toContain("Son gün:");
    expect(both?.text).toContain("Alanlarınızın her biri için ayrı bir konu önerebilirsiniz: Sanat & Edebiyat, Felsefe & Düşünce.");
    expect(both?.html).toContain("Konumu öner");
    expect(mailbox.lastTo("tek@example.com")?.text).not.toContain("her biri için");
    expect(mailbox.lastTo("askida@example.com")).toBeUndefined();

    const bells = await db.select().from(notifications).where(eq(notifications.kind, "issue.topic_opened"));
    expect(bells).toHaveLength(2);

    mailbox.clear();
    expect(await announceOpenedIssueWindows()).toBe(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("announces the delivery window separately when its turn comes", async () => {
    await topicIssueOpenedAgo(HOUR);
    await writer("yazar@example.com");

    expect(await announceOpenedIssueWindows()).toBe(1);
    // Twelve days on the topic window has closed and the delivery one opened
    const later = new Date(Date.now() + 12 * DAY + 60_000);
    expect(await announceOpenedIssueWindows(later)).toBe(1);
    expect(mailbox.lastTo("yazar@example.com")?.subject).toContain("yazı kabul dönemi başladı");
  });

  it("stays quiet for a topic window that opened more than three days ago", async () => {
    await topicIssueOpenedAgo(4 * DAY);
    await writer("yazar@example.com");
    expect(await announceOpenedIssueWindows()).toBe(0);
  });
});
