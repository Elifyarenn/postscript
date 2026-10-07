/**
 * D-331: the category's 1600 words per issue, and the main editor's revision
 * request to the category editor.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, editorCategories, notifications, users, writerAreas, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import {
  createArticle,
  createArticleAsWriter,
  listArticles,
  transitionArticle,
  updateArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { listArticleHistory } from "@/services/article-history";
import { createIssue } from "@/services/issues";
import { setActiveIssue } from "@/services/active-issue";
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

const AREA = "Sanat & Edebiyat";
const OTHER = "Bilim & Teknoloji";
const words = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`).join(" ");

async function failure(promise: Promise<unknown>): Promise<{ status: number; message: string } | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return { status: error.status, message: error.message };
    throw error;
  }
}

async function writer(): Promise<User> {
  const row = await createUser({ role: "writer", writerStatus: "active" });
  await db.update(users).set({ writerArea: AREA, writerArea2: OTHER }).where(eq(users.id, row.id));
  return { ...row, writerArea: AREA, writerArea2: OTHER };
}

async function scenario() {
  const admin = await createUser({ role: "admin" });
  const first = await createIssue(actorOf(admin), { number: 1, title: "Bir" }, noMeta);
  const second = await createIssue(actorOf(admin), { number: 2, title: "İki" }, noMeta);
  return { admin, first, second, ada: await writer(), bora: await writer() };
}

describe("the 1600-word category total (D-331)", () => {
  it("accepts exactly 1600 across authors and refuses one word more", async () => {
    const { ada, bora } = await scenario();
    await createArticleAsWriter(actorOf(ada), { title: "Bin", bodyMarkdown: words(1000), category: AREA }, noMeta);
    await createArticleAsWriter(actorOf(bora), { title: "Altı yüz", bodyMarkdown: words(600), category: AREA }, noMeta);

    const refused = await failure(
      createArticleAsWriter(actorOf(bora), { title: "Bir fazla", bodyMarkdown: words(1), category: AREA }, noMeta),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toContain("1.601");
    // Another category of the same issue has its own total
    await createArticleAsWriter(actorOf(ada), { title: "Başka alan", bodyMarkdown: words(1600), category: OTHER }, noMeta);
  });

  it("keeps each issue's total apart", async () => {
    const { admin, ada, second } = await scenario();
    await createArticleAsWriter(actorOf(ada), { title: "Birinci sayı", bodyMarkdown: words(1600), category: AREA }, noMeta);
    await setActiveIssue(actorOf(admin), second.id, noMeta);
    const next = await createArticleAsWriter(actorOf(ada), { title: "İkinci sayı", bodyMarkdown: words(1600), category: AREA }, noMeta);
    expect(next.issueId).toBe(second.id);
  });

  it("does not count the edited article twice", async () => {
    const { ada, bora } = await scenario();
    const big = await createArticleAsWriter(actorOf(ada), { title: "Bin", bodyMarkdown: words(1000), category: AREA }, noMeta);
    await createArticleAsWriter(actorOf(bora), { title: "Altı yüz", bodyMarkdown: words(600), category: AREA }, noMeta);

    // Saved unchanged at the limit: 1000 is replaced, not added
    await updateArticleAsWriter(actorOf(ada), big.id, { title: "Bin", bodyMarkdown: words(1000), category: AREA }, noMeta);
    expect(
      (await failure(updateArticleAsWriter(actorOf(ada), big.id, { title: "Bin", bodyMarkdown: words(1001), category: AREA }, noMeta)))
        ?.status,
    ).toBe(409);
    await updateArticleAsWriter(actorOf(ada), big.id, { title: "Bin", bodyMarkdown: words(900), category: AREA }, noMeta);
  });

  it("checks a category or issue change at the destination", async () => {
    const { admin, first, second, ada, bora } = await scenario();
    await createArticleAsWriter(actorOf(ada), { title: "Dolu", bodyMarkdown: words(1600), category: AREA }, noMeta);
    const other = await createArticleAsWriter(actorOf(bora), { title: "Taşınacak", bodyMarkdown: words(10), category: OTHER }, noMeta);

    expect(
      (await failure(updateArticle(actorOf(admin), other.id, { title: other.title, category: AREA }, noMeta)))?.status,
    ).toBe(409);
    expect(
      (await failure(createArticle(actorOf(admin), { title: "Editörden", issueId: first.id, category: AREA, bodyMarkdown: "bir" }, noMeta)))
        ?.status,
    ).toBe(409);
    // The other issue's category is empty, so the move is fine there
    const moved = await updateArticle(actorOf(admin), other.id, { title: other.title, issueId: second.id, category: AREA }, noMeta);
    expect(moved.issueId).toBe(second.id);
  });

  it("lets a category already over the limit be shortened, and cuts nothing", async () => {
    const { ada } = await scenario();
    const article = await createArticleAsWriter(actorOf(ada), { title: "Eski", bodyMarkdown: words(10), category: AREA }, noMeta);
    // Older content over the limit, as it may already be in production
    await db.update(articles).set({ bodyMarkdown: words(1800) }).where(eq(articles.id, article.id));

    await updateArticleAsWriter(actorOf(ada), article.id, { title: "Eski", bodyMarkdown: words(1700), category: AREA }, noMeta);
    expect(
      (await failure(updateArticleAsWriter(actorOf(ada), article.id, { title: "Eski", bodyMarkdown: words(1750), category: AREA }, noMeta)))
        ?.status,
    ).toBe(409);
    const [kept] = await db.select().from(articles).where(eq(articles.id, article.id));
    expect(kept!.bodyMarkdown.split(" ")).toHaveLength(1700);
  });

  it("lets only one of two simultaneous saves take the last room", async () => {
    const { ada, bora } = await scenario();
    const results = await Promise.allSettled([
      createArticleAsWriter(actorOf(ada), { title: "Aynı anda A", bodyMarkdown: words(900), category: AREA }, noMeta),
      createArticleAsWriter(actorOf(bora), { title: "Aynı anda B", bodyMarkdown: words(900), category: AREA }, noMeta),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await db.select().from(articles).where(eq(articles.category, AREA));
    expect(rows).toHaveLength(1);
  });
});

describe("the main editor's revision request to the category editor (D-331)", () => {
  async function inMainStage() {
    const { admin, first, ada } = await scenario();
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const categoryEditor = await createUser({ role: "editor", editorStatus: "active" });
    const [area] = await db.select({ id: writerAreas.id }).from(writerAreas).where(eq(writerAreas.name, AREA));
    await db.insert(editorCategories).values({ editorId: categoryEditor.id, areaId: area!.id, slot: 1 });
    const article = await createArticleAsWriter(actorOf(ada), { title: "Ana aşamada", bodyMarkdown: "Metin.", category: AREA }, noMeta);
    await db.update(articles).set({ status: "pending_admin_approval" }).where(eq(articles.id, article.id));
    return { admin, first, ada, main, categoryEditor, article };
  }

  it("sends the article back to the category editor with the note, and tells them", async () => {
    const { main, categoryEditor, article, first } = await inMainStage();

    expect((await failure(transitionArticle(actorOf(main), article.id, "in_review", noMeta)))?.status).toBe(409);
    const back = await transitionArticle(actorOf(main), article.id, "in_review", noMeta, {
      note: "Giriş paragrafını sıkılaştırın.",
    });
    expect(back.status).toBe("in_review");

    const [told] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, categoryEditor.id), eq(notifications.kind, "article.editor_revision_requested")));
    expect(told?.body).toBe("Giriş paragrafını sıkılaştırın.");
    // Not a revision for the author: the author gets no mail
    expect(mailbox.outbox).toHaveLength(0);

    const history = await listArticleHistory(actorOf(categoryEditor), article.id);
    const step = history.find((row) => row.toStatus === "in_review");
    expect(step).toMatchObject({ label: "Ana editör kategori editöründen revizyon istedi", note: "Giriş paragrafını sıkılaştırın." });

    const { items } = await listArticles(actorOf(categoryEditor), { issueId: first.id });
    expect(items.find((row) => row.id === article.id)?.editorRevisionRequested).toBe(true);

    // The category editor acts with what they already may: approve again
    const again = await transitionArticle(actorOf(categoryEditor), article.id, "pending_admin_approval", noMeta);
    expect(again.status).toBe("pending_admin_approval");
  });

  it("is the main editor's: a category editor or the author cannot pull it", async () => {
    const { ada, categoryEditor, article } = await inMainStage();
    expect(
      (await failure(transitionArticle(actorOf(categoryEditor), article.id, "in_review", noMeta, { note: "x y z" })))?.status,
    ).toBe(403);
    expect((await failure(transitionArticle(actorOf(ada), article.id, "in_review", noMeta, { note: "x y z" })))?.status).toBe(403);
  });

  it("still asks the author, named as such", async () => {
    const { main, article, categoryEditor } = await inMainStage();
    await transitionArticle(actorOf(main), article.id, "revision_requested", noMeta, { note: "Yazara not." });
    const history = await listArticleHistory(actorOf(categoryEditor), article.id);
    expect(history.find((row) => row.toStatus === "revision_requested")?.label).toBe("Yazardan revizyon istendi");
  });
});
