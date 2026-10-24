/**
 * Two people editing one article (D-361): a save made from a page drawn before
 * the article last changed is refused with 409 instead of overwriting the other
 * person's text. The writer and the editor are held to the same rule, a status
 * change counts as a change, and a caller with no form behind it is not checked.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articleVersions, articles, users, writerAreas } from "@/db/schema";
import {
  createArticleAsWriter,
  saveAndSubmitArticleAsWriter,
  transitionArticle,
  updateArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  createUser,
  noMeta,
  publishContract,
  reloadUser,
  testIssueId,
} from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(new MemoryMailAdapter());
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

const AREA = "Deneme alanı";
// Set by hand so a save in the same millisecond as the insert cannot look unchanged
const DRAWN_AT = "2026-01-01T09:00:00.000Z";

/** A writer's draft, a main editor who may edit it, and the moment both pages were drawn. */
async function scenario() {
  const admin = await createUser({ role: "admin" });
  const writer = await createUser({ role: "writer", writerStatus: "active", writerArea: AREA });
  const editor = await createUser({ role: "editor" });
  await db.update(users).set({ isMainEditor: true }).where(eq(users.id, editor.id));
  await db.insert(writerAreas).values({ name: AREA });
  await publishContract(actorOf(admin));
  await acceptCurrentContract(writer);
  const writerActor = actorOf(await reloadUser(writer.id));

  const article = await createArticleAsWriter(
    writerActor,
    { issueId: await testIssueId(), title: "Ortak Metin", bodyMarkdown: "İlk hâli.", category: AREA },
    noMeta,
  );
  await db.update(articles).set({ updatedAt: new Date(DRAWN_AT) }).where(eq(articles.id, article.id));

  return { writer: writerActor, editor: actorOf(editor), articleId: article.id };
}

/** The same fields from either panel's form. */
const input = (body: string, expectedUpdatedAt?: string) => ({
  title: "Ortak Metin",
  bodyMarkdown: body,
  category: AREA,
  expectedUpdatedAt,
});

async function stored(articleId: string) {
  const [row] = await db.select().from(articles).where(eq(articles.id, articleId));
  return row!;
}

describe("saving from a page drawn before the last change (D-361)", () => {
  it("saves when nothing changed since the page was drawn, then refuses the same page again", async () => {
    const { writer, articleId } = await scenario();

    await updateArticleAsWriter(writer, articleId, input("İkinci hâli.", DRAWN_AT), noMeta);
    const afterFirst = await stored(articleId);
    expect(afterFirst.bodyMarkdown).toBe("İkinci hâli.");

    // A second tab still holding the first page
    const error = await captureError(
      updateArticleAsWriter(writer, articleId, input("Başka sekmeden.", DRAWN_AT), noMeta),
    );
    expect(error.status).toBe(409);
    expect(error.message).toContain("kaydınız yazılmadı");
    expect((await stored(articleId)).bodyMarkdown).toBe("İkinci hâli.");

    // The page redrawn after the save carries the new moment and goes through
    await updateArticleAsWriter(
      writer,
      articleId,
      input("Üçüncü hâli.", afterFirst.updatedAt.toISOString()),
      noMeta,
    );
    expect((await stored(articleId)).bodyMarkdown).toBe("Üçüncü hâli.");
  });

  it("keeps the writer's text when the editor saves from an older page", async () => {
    const { writer, editor, articleId } = await scenario();

    await updateArticleAsWriter(writer, articleId, input("Yazarın düzeltmesi.", DRAWN_AT), noMeta);
    const error = await captureError(
      updateArticle(editor, articleId, input("Editörün düzeltmesi.", DRAWN_AT), noMeta),
    );

    expect(error.status).toBe(409);
    const row = await stored(articleId);
    expect(row.bodyMarkdown).toBe("Yazarın düzeltmesi.");
    // The refused save leaves no version behind
    const versions = await db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId));
    expect(versions.some((version) => version.bodyMarkdown === "Editörün düzeltmesi.")).toBe(false);
  });

  it("keeps the editor's text when the writer saves from an older page", async () => {
    const { writer, editor, articleId } = await scenario();

    await updateArticle(editor, articleId, input("Editörün düzeltmesi.", DRAWN_AT), noMeta);
    const error = await captureError(
      updateArticleAsWriter(writer, articleId, input("Yazarın düzeltmesi.", DRAWN_AT), noMeta),
    );

    expect(error.status).toBe(409);
    expect((await stored(articleId)).bodyMarkdown).toBe("Editörün düzeltmesi.");
  });

  it("treats a status change as a change", async () => {
    const { writer, editor, articleId } = await scenario();

    await transitionArticle(writer, articleId, "in_review", noMeta, {});
    await transitionArticle(editor, articleId, "revision_requested", noMeta, { note: "Girişi kısaltın." });

    const error = await captureError(
      updateArticleAsWriter(writer, articleId, input("Eski sayfadan.", DRAWN_AT), noMeta),
    );
    expect(error.status).toBe(409);
    expect((await stored(articleId)).bodyMarkdown).toBe("İlk hâli.");
  });

  it("sends nothing for review when the save is refused as stale", async () => {
    const { writer, editor, articleId } = await scenario();

    await updateArticle(editor, articleId, input("Editörün düzeltmesi.", DRAWN_AT), noMeta);
    const error = await captureError(
      saveAndSubmitArticleAsWriter(writer, articleId, input("Yazarın metni.", DRAWN_AT), noMeta),
    );

    expect(error.status).toBe(409);
    expect(error.message).not.toContain("Yazı kaydedildi");
    const row = await stored(articleId);
    expect(row.status).toBe("draft");
    expect(row.bodyMarkdown).toBe("Editörün düzeltmesi.");
  });

  it("does not check a save that names no moment", async () => {
    const { writer, editor, articleId } = await scenario();

    await updateArticle(editor, articleId, input("Editörün düzeltmesi."), noMeta);
    await updateArticleAsWriter(writer, articleId, input("Yazarın metni."), noMeta);
    expect((await stored(articleId)).bodyMarkdown).toBe("Yazarın metni.");
  });

  it("refuses a moment that is not a date", async () => {
    const { writer, articleId } = await scenario();

    const error = await captureError(
      updateArticleAsWriter(writer, articleId, input("Yeni.", "dün"), noMeta),
    );
    expect(error.status).toBe(400);
  });
});
