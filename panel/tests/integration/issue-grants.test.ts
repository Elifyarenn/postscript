/**
 * Opening a closed issue to one writer (D-296): the grant lets that writer,
 * and nobody else, start an article there, and tells them by e-mail.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issueSubmissionGrants, issues, users, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { assertCanReadArticle, createArticleAsWriter } from "@/services/articles";
import { createIssue } from "@/services/issues";
import {
  grantIssueSubmission,
  listIssueGrantsForUser,
  revokeIssueSubmission,
} from "@/services/issue-grants";
import { listIssuesWithoutWindows } from "@/services/topics";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
  mailbox.clear();
});

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return error.status;
    throw error;
  }
}

async function writerWithArea(): Promise<User> {
  const writer = await createUser({ role: "writer", writerStatus: "active" });
  await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));
  return writer;
}

/** Issue 1 as production has it: no windows, and the admins' own working issue. */
async function scenario() {
  const admin = await createUser({ role: "admin" });
  const issue = await createIssue(actorOf(admin), { number: 1, title: "Obsession" }, noMeta);
  await db.update(issues).set({ adminOnly: true }).where(eq(issues.id, issue.id));
  const writer = await writerWithArea();
  const other = await writerWithArea();
  const input = { title: "Bırakamadıklarım", category: "Sanat & Edebiyat", issueId: issue.id };
  return { admin, issue, writer, other, input };
}

describe("an issue closed to new articles", () => {
  it("is not there for a writer until an admin opens it to them", async () => {
    const { issue, writer, input } = await scenario();
    expect((await listIssuesWithoutWindows(writer.id)).map((row) => row.id)).not.toContain(issue.id);
    expect(await statusOf(createArticleAsWriter(actorOf(writer), input, noMeta))).toBe(400);
  });

  it("opens to the one writer, who is mailed at once and can write and read their article", async () => {
    const { admin, issue, writer, other, input } = await scenario();
    await grantIssueSubmission(actorOf(admin), { issueId: issue.id, userId: writer.id }, noMeta);

    expect(mailbox.outbox).toHaveLength(1);
    expect(mailbox.outbox[0]!.to).toBe(writer.email);
    expect(mailbox.outbox[0]!.subject).toBe("postscript · Sayı 1 · Obsession için yazı göndermeniz açıldı");
    expect(mailbox.outbox[0]!.text).toContain("/writer/articles/new");

    expect((await listIssuesWithoutWindows(writer.id)).map((row) => row.id)).toContain(issue.id);
    const article = await createArticleAsWriter(actorOf(writer), input, noMeta);
    expect(article.issueId).toBe(issue.id);
    expect(article.status).toBe("draft");
    await assertCanReadArticle(actorOf(writer), article);

    // The door is this writer's alone
    expect((await listIssuesWithoutWindows(other.id)).map((row) => row.id)).not.toContain(issue.id);
    expect(await statusOf(createArticleAsWriter(actorOf(other), { ...input, title: "Başkası" }, noMeta))).toBe(400);
    expect((await listIssueGrantsForUser(actorOf(admin), writer.id)).map((row) => row.issueNumber)).toEqual([1]);
  });

  it("closes again when the grant is taken back, leaving the started article", async () => {
    const { admin, issue, writer, input } = await scenario();
    await grantIssueSubmission(actorOf(admin), { issueId: issue.id, userId: writer.id }, noMeta);
    const article = await createArticleAsWriter(actorOf(writer), input, noMeta);
    const [grant] = await db.select().from(issueSubmissionGrants);

    await revokeIssueSubmission(actorOf(admin), grant!.id, noMeta);
    expect(await statusOf(createArticleAsWriter(actorOf(writer), { ...input, title: "İkinci" }, noMeta))).toBe(400);
    expect(await db.select().from(articles).where(eq(articles.id, article.id))).toHaveLength(1);
  });

  it("is given once, by an admin only, to an active writer, and not where windows decide", async () => {
    const { admin, issue, writer } = await scenario();
    const grant = { issueId: issue.id, userId: writer.id };

    expect(await statusOf(grantIssueSubmission(actorOf(writer), grant, noMeta))).toBe(403);
    const reader = await createUser({ role: "user" });
    expect(await statusOf(grantIssueSubmission(actorOf(admin), { issueId: issue.id, userId: reader.id }, noMeta))).toBe(409);

    await grantIssueSubmission(actorOf(admin), grant, noMeta);
    expect(await statusOf(grantIssueSubmission(actorOf(admin), grant, noMeta))).toBe(409);
    // One mail, for the one grant that was made
    expect(mailbox.outbox).toHaveLength(1);

    const now = Date.now();
    const windowed = await createIssue(
      actorOf(admin),
      {
        number: 2,
        title: "Gotizm",
        topicOpensAt: new Date(now - 86_400_000),
        topicClosesAt: new Date(now + 86_400_000),
        submissionOpensAt: new Date(now - 86_400_000),
        submissionClosesAt: new Date(now + 2 * 86_400_000),
      },
      noMeta,
    );
    expect(await statusOf(grantIssueSubmission(actorOf(admin), { issueId: windowed.id, userId: writer.id }, noMeta))).toBe(409);
  });
});
