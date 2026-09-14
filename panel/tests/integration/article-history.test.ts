/**
 * An article's step history (D-106, D-107): every step from the audit log in
 * order, the work approval events included. Staff who may read the article see
 * all of it; its author sees it without the plagiarism assessment and without
 * reviewers' notes from the internal stages; everyone else is refused.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, users } from "@/db/schema";
import { addComment, createArticle, setPlagiarismStatus, transitionArticle } from "@/services/articles";
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

/**
 * An article walked to a signed work approval: a revision request the author is
 * e-mailed about, an internal note on the category stage, a plagiarism check
 * and an editorial note on the way.
 */
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
  await transitionArticle(editorActor, article.id, "revision_requested", noMeta, {
    note: "Girişi kısaltın.",
  });
  await transitionArticle(writerActor, article.id, "in_review", noMeta);
  await setPlagiarismStatus(editorActor, article.id, "clean", "Benzerlik bulunmadı.", noMeta);
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

describe("listArticleHistory for editorial staff", () => {
  it("lists every step in order, with who did it and the note they left", async () => {
    const { admin, article } = await reviewedArticle();

    const steps = await listArticleHistory(admin, article.id);
    const labels = steps.map((step) => step.label);

    expect(labels[0]).toBe("Makale kaydı açıldı");
    expect(labels).toContain("İntihal kontrolü: temiz");
    expect(labels).toContain("Editöryal not eklendi");
    expect(labels).toContain("Eser Onayı yazara açıldı");
    expect(labels.at(-1)).toBe("Yazar Eser Onayını imzaladı (yayın adı: gerçek ad)");

    const transitions = steps.filter((step) => step.label === "Durum değişti");
    expect(transitions.map((step) => step.toStatus)).toEqual([
      "in_review",
      "revision_requested",
      "in_review",
      "pending_admin_approval",
      "ready_for_publishing",
      "accepted",
      "awaiting_rights",
    ]);
    expect(transitions.find((step) => step.toStatus === "pending_admin_approval")).toMatchObject({
      fromStatus: "in_review",
      note: "Giriş paragrafı güçlü.",
      actor: "Efe Ana Editör",
    });
    expect(transitions.find((step) => step.toStatus === "accepted")?.actor).toBe("Ayşe Admin");
    expect(steps.at(-1)?.actor).toBe("Ada Yazar");
  });

  it("gives a main editor the same full history as the admin", async () => {
    const { admin, editor, article } = await reviewedArticle();

    expect(await listArticleHistory(editor, article.id)).toEqual(
      await listArticleHistory(admin, article.id),
    );
  });

  it("keeps another article's steps out", async () => {
    const { admin, editor } = await reviewedArticle();
    const other = await createArticle(editor, { title: "Başka Bir Yazı", bodyMarkdown: "Gövde." }, noMeta);

    const steps = await listArticleHistory(admin, other.id);

    expect(steps.map((step) => step.label)).toEqual(["Makale kaydı açıldı"]);
  });
});

describe("listArticleHistory for the author", () => {
  it("shows every step but only the notes the author was e-mailed, and no plagiarism check", async () => {
    const { admin, writer, article } = await reviewedArticle();

    const staffView = await listArticleHistory(admin, article.id);
    const authorView = await listArticleHistory(writer, article.id);

    expect(authorView.map((step) => step.label)).not.toContain("İntihal kontrolü: temiz");
    expect(authorView).toHaveLength(staffView.length - 1);

    const transitions = authorView.filter((step) => step.label === "Durum değişti");
    expect(transitions.find((step) => step.toStatus === "revision_requested")?.note).toBe("Girişi kısaltın.");
    expect(transitions.find((step) => step.toStatus === "pending_admin_approval")?.note).toBeNull();
    expect(JSON.stringify(authorView)).not.toContain("Giriş paragrafı güçlü.");
    expect(JSON.stringify(authorView)).not.toContain("Benzerlik bulunmadı.");
  });
});

describe("listArticleHistory refusals", () => {
  it("never carries the IP address the audit log holds, for anyone", async () => {
    const { admin, writer, article } = await reviewedArticle();

    for (const actor of [admin, writer]) {
      expect(JSON.stringify(await listArticleHistory(actor, article.id))).not.toContain(noMeta.ip);
    }
  });

  it("refuses a category editor whose areas do not cover it, another writer and a reader", async () => {
    const { article } = await reviewedArticle();
    const categoryEditor = await createUser({ role: "editor" });
    const otherWriter = await createUser({ role: "writer", writerStatus: "active" });
    const reader = await createUser();

    for (const actor of [categoryEditor, otherWriter, reader]) {
      const error = await captureError(listArticleHistory(actorOf(actor), article.id));
      expect(error.status, actor.role).toBe(403);
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
