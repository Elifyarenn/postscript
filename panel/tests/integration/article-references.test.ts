/**
 * The source list of an article (D-380): written with the article, kept out of
 * the body and its versions, and still open to the author after submission.
 * Every change is in the audit log with both texts; a withdrawn article and
 * someone else's article are closed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articleVersions, articles, auditLog, writerAreas } from "@/db/schema";
import {
  createArticleAsWriter,
  findArticleById,
  updateArticleAsWriter,
  updateArticleReferencesAsWriter,
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

async function scenario() {
  const admin = await createUser({ role: "admin" });
  const writer = await createUser({ role: "writer", writerStatus: "active", writerArea: AREA });
  await db.insert(writerAreas).values({ name: AREA });
  await publishContract(actorOf(admin));
  await acceptCurrentContract(writer);
  const writerActor = actorOf(await reloadUser(writer.id));

  const article = await createArticleAsWriter(
    writerActor,
    {
      issueId: await testIssueId(),
      title: "Kaynaklı Yazı",
      bodyMarkdown: "Metin.",
      referencesMarkdown: "  - İlk kaynak  ",
      category: AREA,
    },
    noMeta,
  );
  return { writer: writerActor, articleId: article.id };
}

describe("article references (D-380)", () => {
  it("stores the list trimmed with the new article", async () => {
    const { articleId } = await scenario();
    expect((await findArticleById(articleId)).referencesMarkdown).toBe("- İlk kaynak");
  });

  it("lets the author change it after submission without a new body version", async () => {
    const { writer, articleId } = await scenario();
    await db.update(articles).set({ status: "published" }).where(eq(articles.id, articleId));
    const versionsBefore = await db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId));

    const updated = await updateArticleReferencesAsWriter(
      writer,
      articleId,
      { referencesMarkdown: "- İlk kaynak\n- İkinci kaynak" },
      noMeta,
    );

    expect(updated.referencesMarkdown).toBe("- İlk kaynak\n- İkinci kaynak");
    expect(updated.bodyMarkdown).toBe("Metin.");
    expect(updated.status).toBe("published");
    const versionsAfter = await db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId));
    expect(versionsAfter).toHaveLength(versionsBefore.length);

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, articleId), eq(auditLog.action, "article.references_updated")));
    expect(entry?.before).toMatchObject({ referencesMarkdown: "- İlk kaynak" });
    expect(entry?.after).toMatchObject({ referencesMarkdown: "- İlk kaynak\n- İkinci kaynak" });
  });

  it("keeps the list when the draft form saves without touching it", async () => {
    const { writer, articleId } = await scenario();
    await updateArticleAsWriter(writer, articleId, { title: "Kaynaklı Yazı", bodyMarkdown: "Yeni metin.", category: AREA }, noMeta);
    expect((await findArticleById(articleId)).referencesMarkdown).toBe("- İlk kaynak");
  });

  it("refuses a withdrawn article and another author's article", async () => {
    const { writer, articleId } = await scenario();
    const other = await createUser({ role: "writer", writerStatus: "active", writerArea: AREA });

    const foreign = await captureError(
      updateArticleReferencesAsWriter(actorOf(other), articleId, { referencesMarkdown: "- x" }, noMeta),
    );
    expect(foreign.status).toBe(403);

    await db.update(articles).set({ status: "withdrawn" }).where(eq(articles.id, articleId));
    const withdrawn = await captureError(
      updateArticleReferencesAsWriter(writer, articleId, { referencesMarkdown: "- x" }, noMeta),
    );
    expect(withdrawn.status).toBe(409);
  });

  it("refuses a save from a page drawn before the article changed (D-361)", async () => {
    const { writer, articleId } = await scenario();
    await db
      .update(articles)
      .set({ updatedAt: new Date("2026-01-02T09:00:00.000Z") })
      .where(eq(articles.id, articleId));

    const error = await captureError(
      updateArticleReferencesAsWriter(
        writer,
        articleId,
        { referencesMarkdown: "- x", expectedUpdatedAt: "2026-01-01T09:00:00.000Z" },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });
});
