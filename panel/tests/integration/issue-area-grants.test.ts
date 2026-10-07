/**
 * A temporary area for one issue (D-306): the writer may propose a topic and
 * file an article under it in that issue only, and is mailed when it is given.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users, writerAreas, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { createArticleAsWriter } from "@/services/articles";
import { selectableWriterCategories } from "@/services/editor-categories";
import { createIssue } from "@/services/issues";
import { setActiveIssue } from "@/services/active-issue";
import { grantIssueArea, listIssueAreaGrantsForUser, revokeIssueArea } from "@/services/issue-area-grants";
import { listWriterIssues, submitTopicProposal } from "@/services/topics";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";
import { DEFAULT_WRITER_AREAS } from "@/lib/writer-areas";

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

const OWN = "Sanat & Edebiyat";

async function areaId(name: string): Promise<string> {
  const [row] = await db.select({ id: writerAreas.id }).from(writerAreas).where(eq(writerAreas.name, name));
  return row!.id;
}

async function scenario() {
  const admin = await createUser({ role: "admin" });
  const first = await createIssue(actorOf(admin), { number: 1, title: "Obsession" }, noMeta);
  const second = await createIssue(actorOf(admin), { number: 2, title: "Gotizm" }, noMeta);
  const writer: User = await createUser({ role: "writer", writerStatus: "active" });
  await db.update(users).set({ writerArea: OWN }).where(eq(users.id, writer.id));
  const extra = DEFAULT_WRITER_AREAS.find((name) => name !== OWN)!;
  return { admin, first, second, writer: { ...writer, writerArea: OWN }, extra };
}

describe("a temporary area for one issue", () => {
  it("opens the area in that issue only, and mails the writer", async () => {
    const { admin, first, second, writer, extra } = await scenario();
    await grantIssueArea(actorOf(admin), { issueId: first.id, userId: writer.id, areaId: await areaId(extra) }, noMeta);

    expect(mailbox.outbox).toHaveLength(1);
    expect(mailbox.outbox[0]!.to).toBe(writer.email);
    expect(mailbox.outbox[0]!.subject).toContain(extra);
    expect(mailbox.outbox[0]!.text).toContain("Sayı 1 · Obsession");

    expect(await selectableWriterCategories(actorOf(writer), first.id)).toEqual(expect.arrayContaining([OWN, extra]));
    expect(await selectableWriterCategories(actorOf(writer), second.id)).toEqual([OWN]);
    expect(await selectableWriterCategories(actorOf(writer))).toEqual([OWN]);

    const article = await createArticleAsWriter(
      actorOf(writer),
      { title: "Geçici Alanda", category: extra, issueId: first.id },
      noMeta,
    );
    expect(article.category).toBe(extra);
    // The second issue made active, so the area, not the issue, is what is refused (D-330)
    await setActiveIssue(actorOf(admin), second.id, noMeta);
    expect(
      await statusOf(createArticleAsWriter(actorOf(writer), { title: "Başka Sayıda", category: extra, issueId: second.id }, noMeta)),
    ).toBe(400);

    const [grant] = await listIssueAreaGrantsForUser(actorOf(admin), writer.id);
    expect(grant).toMatchObject({ issueNumber: 1, areaName: extra });
    await revokeIssueArea(actorOf(admin), grant!.id, noMeta);
    expect(await selectableWriterCategories(actorOf(writer), first.id)).toEqual([OWN]);
  });

  it("lets the writer propose a topic in the area for that issue's window", async () => {
    const { admin, writer, extra } = await scenario();
    const now = Date.now();
    const windowed = await createIssue(
      actorOf(admin),
      {
        number: 3,
        title: "Pencereli",
        topicOpensAt: new Date(now - 86_400_000),
        topicClosesAt: new Date(now + 86_400_000),
        submissionOpensAt: new Date(now + 2 * 86_400_000),
        submissionClosesAt: new Date(now + 3 * 86_400_000),
      },
      noMeta,
    );
    await grantIssueArea(actorOf(admin), { issueId: windowed.id, userId: writer.id, areaId: await areaId(extra) }, noMeta);

    const entry = (await listWriterIssues(actorOf(writer))).find((row) => row.issue.id === windowed.id)!;
    expect(entry.areas).toEqual(expect.arrayContaining([OWN, extra]));
    expect(entry.canProposeMore).toBe(true);

    const topic = await submitTopicProposal(
      actorOf(writer),
      windowed.id,
      { title: "Geçici alan konusu", description: "Bu sayı için verilen alanda bir konu.", category: extra },
      noMeta,
    );
    expect(topic.category).toBe(extra);
  });

  it("is given by an admin only, to an active writer, for an area not already theirs", async () => {
    const { admin, first, writer, extra } = await scenario();
    const input = { issueId: first.id, userId: writer.id, areaId: await areaId(extra) };

    expect(await statusOf(grantIssueArea(actorOf(writer), input, noMeta))).toBe(403);
    expect(await statusOf(grantIssueArea(actorOf(admin), { ...input, areaId: await areaId(OWN) }, noMeta))).toBe(409);
    const reader = await createUser({ role: "user" });
    expect(await statusOf(grantIssueArea(actorOf(admin), { ...input, userId: reader.id }, noMeta))).toBe(409);
    expect(await statusOf(grantIssueArea(actorOf(admin), { ...input, userId: admin.id }, noMeta))).toBe(409);

    await grantIssueArea(actorOf(admin), input, noMeta);
    expect(await statusOf(grantIssueArea(actorOf(admin), input, noMeta))).toBe(409);
    expect(mailbox.outbox).toHaveLength(1);
  });
});
