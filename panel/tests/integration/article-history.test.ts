/**
 * The admin's step history of an article (D-106): every step from the audit
 * log in order, the work approval events included, and nobody but the admin.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, users } from "@/db/schema";
import { addComment, createArticle, transitionArticle } from "@/services/articles";
import { approveWork, articleHash, findLiveApproval } from "@/services/rights";
import { listArticleHistory } from "@/services/article-history";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
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
  setStorageAdapter(new MemoryStorageAdapter());
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

/** An article walked to a signed work approval, with a reviewer's note on the way. */
async function reviewedArticle() {
  const admin = await createUser({ role: "admin", displayName: "Ayşe Admin" });
  const editor = await createUser({ role: "editor", displayName: "Efe Ana Editör" });
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement", displayName: "Ada Yazar" });
  await db.update(users).set({ isMainEditor: true }).where(eq(users.id, editor.id));

  await publishContract(actorOf(admin));
  await acceptCurrentContract(writer);

  const editorActor = actorOf(editor);
  const adminActor = actorOf(admin);
  const writerActor = actorOf({ ...writer, writerStatus: "active" });

  const article = await createArticle(
    editorActor,
    { title: "Süreç Geçmişi Denemesi", bodyMarkdown: "Gövde metni.", authorId: writer.id },
    noMeta,
  );
  await transitionArticle(editorActor, article.id, "in_review", noMeta);
  await transitionArticle(editorActor, article.id, "pending_admin_approval", noMeta, {
    note: "Giriş paragrafı güçlü.",
  });
  await transitionArticle(editorActor, article.id, "ready_for_publishing", noMeta);
  await addComment(editorActor, article.id, "Başlığı kısaltalım.", noMeta);
  await transitionArticle(adminActor, article.id, "accepted", noMeta);

  const approval = await findLiveApproval(article.id);
  const [current] = await db.select().from(articles).where(eq(articles.id, article.id));
  await approveWork(
    writerActor,
    {
      grantId: approval!.id,
      articleHash: articleHash(current!.bodyMarkdown),
      bylineChoice: "real_name",
      acknowledged: true,
    },
    noMeta,
  );

  return { admin: adminActor, editor: editorActor, writer: writerActor, article };
}

describe("listArticleHistory", () => {
  it("lists every step in order, with who did it and the note they left", async () => {
    const { admin, article } = await reviewedArticle();

    const steps = await listArticleHistory(admin, article.id);
    const labels = steps.map((step) => step.label);

    expect(labels[0]).toBe("Makale kaydı açıldı");
    expect(labels).toContain("Editöryal not eklendi");
    expect(labels).toContain("Eser Onayı yazara açıldı");
    expect(labels.at(-1)).toBe("Yazar Eser Onayını imzaladı (yayın adı: gerçek ad)");

    const transitions = steps.filter((step) => step.label === "Durum değişti");
    expect(transitions.map((step) => step.toStatus)).toEqual([
      "in_review",
      "pending_admin_approval",
      "ready_for_publishing",
      "accepted",
      "awaiting_rights",
    ]);

    const categoryApproval = transitions.find((step) => step.toStatus === "pending_admin_approval");
    expect(categoryApproval).toMatchObject({
      fromStatus: "in_review",
      note: "Giriş paragrafı güçlü.",
      actor: "Efe Ana Editör",
    });
    expect(transitions.find((step) => step.toStatus === "accepted")?.actor).toBe("Ayşe Admin");
    expect(steps.at(-1)?.actor).toBe("Ada Yazar");
  });

  it("never carries the IP address the audit log holds", async () => {
    const { admin, article } = await reviewedArticle();

    const steps = await listArticleHistory(admin, article.id);

    expect(JSON.stringify(steps)).not.toContain(noMeta.ip);
  });

  it("keeps another article's steps out", async () => {
    const { admin, editor } = await reviewedArticle();
    const other = await createArticle(editor, { title: "Başka Bir Yazı", bodyMarkdown: "Gövde." }, noMeta);

    const steps = await listArticleHistory(admin, other.id);

    expect(steps.map((step) => step.label)).toEqual(["Makale kaydı açıldı"]);
  });

  it("is closed to the main editor and the writer", async () => {
    const { editor, writer, article } = await reviewedArticle();

    for (const actor of [editor, writer]) {
      const error = await captureError(listArticleHistory(actor, article.id));
      expect(error.status).toBe(403);
    }
  });

  it("answers 404 for an article that does not exist", async () => {
    const admin = await createUser({ role: "admin" });

    const error = await captureError(
      listArticleHistory(actorOf(admin), "00000000-0000-0000-0000-000000000000"),
    );

    expect(error.status).toBe(404);
  });
});
