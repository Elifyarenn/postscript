/**
 * The active issue (D-330): new articles go into it on their own, a published
 * issue takes nothing new, lists show one issue at a time, and the main editor
 * runs the outbox and the temporary areas.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issues, users, writerAreas, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import {
  countArticlesByStatus,
  createArticle,
  createArticleAsWriter,
  listArticles,
  listArticlesForWriter,
  transitionArticle,
  updateArticle,
} from "@/services/articles";
import { createIssue } from "@/services/issues";
import { getActiveIssue, setActiveIssue } from "@/services/active-issue";
import { mailQueueOverview, mayManageMailQueue } from "@/services/mail-queue";
import { grantIssueArea, listIssueAreaGrantsForIssue, mayManageIssueAreaGrants } from "@/services/issue-area-grants";
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

async function failure(promise: Promise<unknown>): Promise<{ status: number; message: string } | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return { status: error.status, message: error.message };
    throw error;
  }
}

const AREA = "Sanat & Edebiyat";

async function publish(issueId: string) {
  await db.update(issues).set({ status: "published", publishedAt: new Date() }).where(eq(issues.id, issueId));
}

/** Issue 1 holds a draft and a published article, then is published; issue 2 is open. */
async function scenario() {
  const admin = await createUser({ role: "admin" });
  const writer: User = await createUser({ role: "writer", writerStatus: "active" });
  await db.update(users).set({ writerArea: AREA }).where(eq(users.id, writer.id));
  const first = await createIssue(actorOf(admin), { number: 1, title: "Obsession" }, noMeta);
  const second = await createIssue(actorOf(admin), { number: 2, title: "Gotizm" }, noMeta);
  const writerActor = actorOf({ ...writer, writerArea: AREA });

  const leftDraft = await createArticleAsWriter(
    writerActor,
    { title: "Yarım kalan", bodyMarkdown: "Bir iki üç.", category: AREA },
    noMeta,
  );
  const printed = await createArticleAsWriter(
    writerActor,
    { title: "Basılan yazı", bodyMarkdown: "Dört beş.", category: AREA },
    noMeta,
  );
  await db.update(articles).set({ status: "published", publishedAt: new Date() }).where(eq(articles.id, printed.id));
  await publish(first.id);
  return { admin, writer: writerActor, first, second, leftDraft, printed };
}

describe("the active issue", () => {
  it("moves on to the next issue by itself once an issue is published", async () => {
    const { first, second, leftDraft } = await scenario();
    // Written while issue 1 was the open one
    expect(leftDraft.issueId).toBe(first.id);
    expect((await getActiveIssue())?.id).toBe(second.id);
  });

  it("files a writer's new article into the active issue without asking", async () => {
    const { writer, second } = await scenario();
    const article = await createArticleAsWriter(writer, { title: "Yeni sayıya", category: AREA }, noMeta);
    expect(article.issueId).toBe(second.id);
  });

  it("refuses a new article for the published issue 1", async () => {
    const { writer, first } = await scenario();
    const refused = await failure(
      createArticleAsWriter(writer, { title: "Geç kalan", category: AREA, issueId: first.id }, noMeta),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toContain("Sayı 2");
  });

  it("refuses handing in a draft left in the published issue", async () => {
    const { writer, leftDraft } = await scenario();
    const refused = await failure(transitionArticle(writer, leftDraft.id, "in_review", noMeta));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toContain("yayımlandı");
  });

  it("refuses moving an article into the published issue, and a published one out", async () => {
    const { admin, writer, first, second, leftDraft, printed } = await scenario();
    const fresh = await createArticleAsWriter(writer, { title: "Taşınmasın", category: AREA }, noMeta);
    expect(
      (await failure(updateArticle(actorOf(admin), fresh.id, { title: fresh.title, issueId: first.id }, noMeta)))?.status,
    ).toBe(409);
    expect(
      (await failure(updateArticle(actorOf(admin), printed.id, { title: printed.title, issueId: second.id }, noMeta)))
        ?.status,
    ).toBe(409);
    // A draft that was never printed may leave the closed issue for the open one
    const moved = await updateArticle(actorOf(admin), leftDraft.id, { title: leftDraft.title, issueId: second.id }, noMeta);
    expect(moved.issueId).toBe(second.id);
    // The editor's own form refuses the closed issue as well
    expect(
      (await failure(createArticle(actorOf(admin), { title: "Editörden", issueId: first.id }, noMeta)))?.status,
    ).toBe(409);
  });

  it("is set by an admin only, and only to an open issue", async () => {
    const { admin, first } = await scenario();
    const third = await createIssue(actorOf(admin), { number: 3, title: "Sonraki" }, noMeta);
    const editor = await createUser({ role: "editor" });
    expect((await failure(setActiveIssue(actorOf(editor), third.id, noMeta)))?.status).toBe(403);
    expect((await failure(setActiveIssue(actorOf(admin), first.id, noMeta)))?.status).toBe(409);
    await setActiveIssue(actorOf(admin), third.id, noMeta);
    expect((await getActiveIssue())?.id).toBe(third.id);
  });
});

describe("one issue per list", () => {
  it("lists, counts and pages only the chosen issue", async () => {
    const { admin, writer, first, second } = await scenario();
    await createArticleAsWriter(writer, { title: "İkinci sayıda", bodyMarkdown: "<p>Üç **kelime** var</p>", category: AREA }, noMeta);

    const inSecond = await listArticles(actorOf(admin), { issueId: second.id });
    expect(inSecond.total).toBe(1);
    expect(inSecond.items.map((row) => row.title)).toEqual(["İkinci sayıda"]);
    // Tags and markdown marks are not words
    expect(inSecond.items[0]!.wordCount).toBe(3);

    const inFirst = await listArticles(actorOf(admin), { issueId: first.id, limit: 1 });
    expect(inFirst.total).toBe(2);
    expect(inFirst.items).toHaveLength(1);
    expect(inFirst.items.every((row) => row.issueId === first.id)).toBe(true);

    const searched = await listArticles(actorOf(admin), { issueId: first.id, q: "basılan" });
    expect(searched.items.map((row) => row.title)).toEqual(["Basılan yazı"]);

    const counts = await countArticlesByStatus(actorOf(admin), { issueId: first.id });
    expect(counts.get("published")).toBe(1);
    expect(counts.get("draft")).toBe(1);

    const own = await listArticlesForWriter(writer, second.id);
    expect(own.map((row) => row.title)).toEqual(["İkinci sayıda"]);
  });
});

describe("the main editor", () => {
  async function editors() {
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const plain = await createUser({ role: "editor", editorStatus: "active" });
    return { main: actorOf(main), plain: actorOf(plain) };
  }

  it("sees and runs the mail queue; a category editor does not", async () => {
    const { main, plain } = await editors();
    expect(await mayManageMailQueue(main)).toBe(true);
    expect(await mayManageMailQueue(plain)).toBe(false);
    await expect(mailQueueOverview(main)).resolves.toBeDefined();
    expect((await failure(mailQueueOverview(plain)))?.status).toBe(403);
  });

  it("hands out a temporary area in the active issue; a category editor cannot", async () => {
    const { writer, second } = await scenario();
    const { main, plain } = await editors();
    const extra = DEFAULT_WRITER_AREAS.find((name) => name !== AREA)!;
    const [area] = await db.select({ id: writerAreas.id }).from(writerAreas).where(eq(writerAreas.name, extra));

    expect(await mayManageIssueAreaGrants(plain)).toBe(false);
    expect(
      (await failure(grantIssueArea(plain, { issueId: second.id, userId: writer.id, areaId: area!.id }, noMeta)))?.status,
    ).toBe(403);

    await grantIssueArea(main, { issueId: second.id, userId: writer.id, areaId: area!.id }, noMeta);
    await createArticleAsWriter(writer, { title: "Geçici alanda", bodyMarkdown: "Bir iki.", category: extra }, noMeta);

    const [grant] = await listIssueAreaGrantsForIssue(main, second.id);
    expect(grant).toMatchObject({ areaName: extra });
    expect(grant!.articles.map((row) => [row.title, row.wordCount])).toEqual([["Geçici alanda", 2]]);
  });
});
