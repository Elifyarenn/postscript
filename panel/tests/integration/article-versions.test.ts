/**
 * Reading an article's earlier versions (D-108): the stored text, who saved it,
 * the version before it for comparison, and the same readers as the version list.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articleVersions, users } from "@/db/schema";
import { createArticle, getArticleVersion } from "@/services/articles";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  createUser,
  noMeta,
  publishContract,
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

/** An article with its first version and a second one saved by the main editor. */
async function articleWithTwoVersions() {
  const admin = await createUser({ role: "admin" });
  const editor = await createUser({ role: "editor", displayName: "Efe Ana Editör" });
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });
  await db.update(users).set({ isMainEditor: true }).where(eq(users.id, editor.id));
  await publishContract(actorOf(admin));
  await acceptCurrentContract(writer);

  const article = await createArticle(
    actorOf(editor),
    { title: "Sürüm Denemesi", bodyMarkdown: "## Giriş\nEski cümle.", authorId: writer.id },
    noMeta,
  );
  await db.insert(articleVersions).values({
    articleId: article.id,
    version: 2,
    bodyMarkdown: "## Giriş\nYeni cümle.",
    changedBy: editor.id,
    changeNote: "Cümle yenilendi.",
    changeKind: "content_change",
  });

  return {
    editor: actorOf(editor),
    writer: actorOf({ ...writer, writerStatus: "active" }),
    article,
  };
}

describe("getArticleVersion", () => {
  it("returns the stored text, who saved it and the version before it", async () => {
    const { editor, article } = await articleWithTwoVersions();

    const { version, previous } = await getArticleVersion(editor, article.id, "2");

    expect(version).toMatchObject({
      version: 2,
      bodyMarkdown: "## Giriş\nYeni cümle.",
      changeNote: "Cümle yenilendi.",
      changeKind: "content_change",
      changedByName: "Efe Ana Editör",
    });
    expect(previous?.version).toBe(1);
    expect(previous?.bodyMarkdown).toBe("## Giriş\nEski cümle.");
  });

  it("has nothing to compare the first version with", async () => {
    const { editor, article } = await articleWithTwoVersions();

    const { version, previous } = await getArticleVersion(editor, article.id, 1);

    expect(version.version).toBe(1);
    expect(previous).toBeNull();
  });

  it("lets the author read the versions of their own article", async () => {
    const { writer, article } = await articleWithTwoVersions();

    const { version } = await getArticleVersion(writer, article.id, "1");

    expect(version.bodyMarkdown).toBe("## Giriş\nEski cümle.");
  });

  it("refuses another writer, a reader and a category editor whose areas do not cover it", async () => {
    const { article } = await articleWithTwoVersions();
    const otherWriter = await createUser({ role: "writer", writerStatus: "active" });
    const reader = await createUser();
    const categoryEditor = await createUser({ role: "editor" });

    for (const actor of [otherWriter, reader, categoryEditor]) {
      const error = await captureError(getArticleVersion(actorOf(actor), article.id, "1"));
      expect(error.status, actor.role).toBe(403);
    }
  });

  it("answers 404 for a version that does not exist or is not a number", async () => {
    const { editor, article } = await articleWithTwoVersions();

    for (const raw of ["3", "0", "abc", "1.5"]) {
      const error = await captureError(getArticleVersion(editor, article.id, raw));
      expect(error.status, raw).toBe(404);
    }
  });
});
