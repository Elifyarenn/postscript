/**
 * Editor area assignments and the staged review chain (D-059, D-060).
 *
 * The rules that matter: one area belongs to exactly one editor, an editor
 * holds at most two areas, the category editor only sees and approves their
 * own areas, the main editor runs the second stage, and the admin accepts the
 * article into the publication flow. A hybrid editor is simultaneously a
 * writer and can author articles.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, editorCategories, users } from "@/db/schema";
import { setEditorDuties } from "@/services/editor-categories";
import {
  addComment,
  createArticle,
  createArticleAsWriter,
  listArticleVersions,
  listArticles,
  setPlagiarismStatus,
  transitionArticle,
  updateArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { setHybridWriterRole } from "@/services/users";
import { setWriterAreas } from "@/services/writer-areas";
import { isAppError } from "@/lib/errors";
import {
  resetTables,
  seedDefaultWriterAreas,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";
import { publishContract } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
  await seedDefaultWriterAreas();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
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

async function areaIdByName(name: string) {
  const { writerAreas } = await import("@/db/schema");
  const rows = await db.select({ id: writerAreas.id }).from(writerAreas).where(eq(writerAreas.name, name)).limit(1);
  return rows[0]!.id;
}

describe("editor area assignments", () => {
  it("assigns an editor two areas and a main-editor flag", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });

    await setEditorDuties(
      actorOf(admin),
      editor.id,
      {
        areaId: await areaIdByName("Sanat & Edebiyat"),
        areaId2: await areaIdByName("Psikoloji & İlişkiler"),
        isMainEditor: true,
      },
      noMeta,
    );

    const duties = await db
      .select()
      .from(editorCategories)
      .where(eq(editorCategories.editorId, editor.id))
      .orderBy(editorCategories.slot);
    expect(duties.map((duty) => duty.slot)).toEqual([1, 2]);

    const { getEditorAssignment } = await import("@/services/editor-categories");
    const assignment = await getEditorAssignment(editor.id);
    expect(assignment.isMainEditor).toBe(true);
    expect(assignment.assignedAreas).toEqual(["Sanat & Edebiyat", "Psikoloji & İlişkiler"]);
  });

  it("gives one area to exactly one editor (409 on the second)", async () => {
    const admin = await createUser({ role: "admin" });
    const editorA = await createUser({ role: "editor" });
    const editorB = await createUser({ role: "editor" });

    const sanat = await areaIdByName("Sanat & Edebiyat");
    await setEditorDuties(
      actorOf(admin),
      editorA.id,
      { areaId: sanat, areaId2: null, isMainEditor: false },
      noMeta,
    );

    const error = await captureError(
      setEditorDuties(
        actorOf(admin),
        editorB.id,
        { areaId: sanat, areaId2: null, isMainEditor: false },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/başka bir editöre/i);
  });

  it("refuses non-editors and lets the editor hold at most two slots", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const error = await captureError(
      setEditorDuties(actorOf(admin), writer.id, { areaId: null, areaId2: null, isMainEditor: false }, noMeta),
    );
    expect(error.status).toBe(409);

    // The service replaces rows rather than appending, so a third area never
    // exists: reassigning keeps exactly two slots at most.
    const editor = await createUser({ role: "editor" });
    await setEditorDuties(
      actorOf(admin),
      editor.id,
      { areaId: await areaIdByName("Sanat & Edebiyat"), areaId2: await areaIdByName("Psikoloji & İlişkiler"), isMainEditor: false },
      noMeta,
    );
    await setEditorDuties(
      actorOf(admin),
      editor.id,
      { areaId: await areaIdByName("Tarih & Dünya"), areaId2: await areaIdByName("Felsefe & Düşünce"), isMainEditor: false },
      noMeta,
    );
    const duties = await db
      .select()
      .from(editorCategories)
      .where(eq(editorCategories.editorId, editor.id));
    expect(duties).toHaveLength(2);
    expect(duties.map((duty) => duty.slot).sort()).toEqual([1, 2]);
  });
});

describe("the hybrid role (D-060)", () => {
  it("makes an editor a writer and back", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });

    const enabled = await setHybridWriterRole(actorOf(admin), editor.id, true, noMeta);
    expect(enabled.writerStatus).toBe("active");

    const { isHybrid } = await import("@/lib/auth/rbac");
    expect(isHybrid(actorOf(enabled))).toBe(true);

    const disabled = await setHybridWriterRole(actorOf(admin), editor.id, false, noMeta);
    expect(disabled.writerStatus).toBeNull();
    expect(isHybrid(actorOf(disabled))).toBe(false);
  });

  it("refuses the toggle for a non-editor", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const error = await captureError(setHybridWriterRole(actorOf(admin), writer.id, true, noMeta));
    expect(error.status).toBe(409);
  });
});

describe("the staged review chain", () => {
  /** A writer, a category editor, a main editor, an admin and a seeded article. */
  async function chainScenario() {
    await publishContract(actorOf(await createUser({ role: "admin" })));

    const admin = await createUser({ role: "admin" });
    const categoryEditor = await createUser({ role: "editor" });
    const mainEditor = await createUser({ role: "editor" });
    const otherEditor = await createUser({ role: "editor" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));

    await setEditorDuties(
      actorOf(admin),
      categoryEditor.id,
      {
        areaId: await areaIdByName("Sanat & Edebiyat"),
        areaId2: await areaIdByName("Psikoloji & İlişkiler"),
        isMainEditor: false,
      },
      noMeta,
    );
    await setEditorDuties(
      actorOf(admin),
      otherEditor.id,
      { areaId: await areaIdByName("Bilim & Teknoloji"), areaId2: null, isMainEditor: false },
      noMeta,
    );
    await setEditorDuties(
      actorOf(admin),
      mainEditor.id,
      { areaId: null, areaId2: null, isMainEditor: true },
      noMeta,
    );

    return { admin, categoryEditor, mainEditor, otherEditor, writer };
  }

  it("walks draft → in_review → pending_admin_approval → ready_for_publishing → accepted", async () => {
    const { admin, categoryEditor, mainEditor, writer } = await chainScenario();

    const draft = await createArticleAsWriter(
      actorOf(writer),
      { title: "Dört Aşamalı Deneme", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    expect(draft.status).toBe("draft");
    expect(draft.authorId).toBe(writer.id);

    await transitionArticle(actorOf(writer), draft.id, "in_review", noMeta);

    // Stage 2 — the category editor of "Sanat & Edebiyat" approves
    const stage2 = await transitionArticle(actorOf(categoryEditor), draft.id, "pending_admin_approval", noMeta);
    expect(stage2.status).toBe("pending_admin_approval");

    // Stage 3 — the main editor hands it to the admin's publication queue
    const stage3 = await transitionArticle(actorOf(mainEditor), draft.id, "ready_for_publishing", noMeta);
    expect(stage3.status).toBe("ready_for_publishing");

    // Stage 4 — the admin accepts; the publication flow opens the Eser Onayı
    const stage4 = await transitionArticle(actorOf(admin), draft.id, "accepted", noMeta);
    expect(stage4.status).toBe("awaiting_rights");

    const { findLiveApproval } = await import("@/services/rights");
    const approval = await findLiveApproval(draft.id);
    expect(approval?.status).toBe("pending");
  });

  it("stores the author's slug and validates it (D-069)", async () => {
    const { writer } = await chainScenario();

    // An explicit, well-formed slug is stored as given
    const draft = await createArticleAsWriter(
      actorOf(writer),
      {
        title: "Sluglu Deneme",
        slug: "sluglu-deneme",
        bodyMarkdown: "Gövde.",
        category: "Sanat & Edebiyat",
      },
      noMeta,
    );
    expect(draft.slug).toBe("sluglu-deneme");

    // A malformed slug is refused at the service layer
    const badSlug = await captureError(
      createArticleAsWriter(
        actorOf(writer),
        { title: "Bozuk Slug", slug: "Bozuk_Slug!", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
        noMeta,
      ),
    );
    expect(badSlug.status).toBe(400);

    // The dropped fields are no longer accepted at all (D-082)
    const staleField = await captureError(
      createArticleAsWriter(
        actorOf(writer),
        { title: "Eski Alan", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat", tags: ["deneme"] },
        noMeta,
      ),
    );
    expect(staleField.status).toBe(400);

    // A slug that is already taken is a 409, not a silent suffix
    const taken = await captureError(
      createArticleAsWriter(
        actorOf(writer),
        { title: "Tekrar", slug: "sluglu-deneme", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
        noMeta,
      ),
    );
    expect(taken.status).toBe(409);

    // The slug follows an edited title when none is given
    const updated = await updateArticleAsWriter(
      actorOf(writer),
      draft.id,
      {
        title: "Sluglu Deneme II",
        bodyMarkdown: "Gövde.",
        category: "Sanat & Edebiyat",
      },
      noMeta,
    );
    expect(updated.slug).toBe("sluglu-deneme-ii");
  });

  it("keeps a category editor out of another editor's areas and out of later stages", async () => {
    const { admin, categoryEditor, mainEditor, otherEditor, writer } = await chainScenario();

    const draft = await createArticleAsWriter(
      actorOf(writer),
      { title: "Alan Dışı", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    await transitionArticle(actorOf(writer), draft.id, "in_review", noMeta);

    // The "Bilim & Teknoloji" editor has no say over this article
    const denied = await captureError(
      transitionArticle(actorOf(otherEditor), draft.id, "pending_admin_approval", noMeta),
    );
    expect(denied.status).toBe(403);

    await transitionArticle(actorOf(categoryEditor), draft.id, "pending_admin_approval", noMeta);

    // The category editor cannot skip the main stage either
    const skipped = await captureError(
      transitionArticle(actorOf(categoryEditor), draft.id, "ready_for_publishing", noMeta),
    );
    expect(skipped.status).toBe(403);

    // …and the admin final gate is closed to every editor
    const finalDenied = await captureError(
      transitionArticle(actorOf(mainEditor), draft.id, "accepted", noMeta),
    );
    expect(finalDenied.status).toBe(403);

    await transitionArticle(actorOf(mainEditor), draft.id, "ready_for_publishing", noMeta);
    const accepted = await transitionArticle(actorOf(admin), draft.id, "accepted", noMeta);
    expect(accepted.status).toBe("awaiting_rights");
  });

  it("scopes the review list to the category editor's own areas", async () => {
    const { admin, categoryEditor, otherEditor, writer } = await chainScenario();
    await setWriterAreas(
      actorOf(admin),
      writer.id,
      { area: "Sanat & Edebiyat", area2: "Bilim & Teknoloji" },
      noMeta,
    );

    await createArticleAsWriter(
      actorOf(writer),
      { title: "Benim Alanım", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    await createArticleAsWriter(
      actorOf(writer),
      { title: "Başka Alan", bodyMarkdown: "Gövde.", category: "Bilim & Teknoloji" },
      noMeta,
    );

    const mine = await listArticles(actorOf(categoryEditor), { limit: 20 });
    expect(mine.map((article) => article.category)).not.toContain("Bilim & Teknoloji");
    expect(mine.map((article) => article.category)).toContain("Sanat & Edebiyat");

    const others = await listArticles(actorOf(otherEditor), { limit: 20 });
    expect(others.map((article) => article.category)).not.toContain("Sanat & Edebiyat");
    expect(others.map((article) => article.category)).toContain("Bilim & Teknoloji");
  });
});

describe("an author's own submissions", () => {
  it("forces the author and their own areas on the article", async () => {
    await publishContract(actorOf(await createUser({ role: "admin" })));
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));

    const article = await createArticleAsWriter(
      actorOf(writer),
      { title: "Kendi Yazım", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    expect(article.authorId).toBe(writer.id);

    // A category outside the author's areas is refused
    const error = await captureError(
      createArticleAsWriter(
        actorOf(writer),
        { title: "Yanlış Alan", bodyMarkdown: "Gövde.", category: "Tarih & Dünya" },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/size tanımlı değil/i);

    // A plain user cannot author articles
    const reader = await createUser({ role: "user" });
    const denied = await captureError(
      createArticleAsWriter(
        actorOf(reader),
        { title: "Yetkisiz", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
        noMeta,
      ),
    );
    expect(denied.status).toBe(403);

    // A hybrid editor who holds the area can write in it
    const hybrid = await createUser({ role: "editor" });
    await setHybridWriterRole(actorOf(admin), hybrid.id, true, noMeta);
    await setEditorDuties(
      actorOf(admin),
      hybrid.id,
      { areaId: await areaIdByName("Sanat & Edebiyat"), areaId2: null, isMainEditor: false },
      noMeta,
    );
    const hybridRow = await db.select().from(users).where(eq(users.id, hybrid.id)).limit(1);
    const hybridArticle = await createArticleAsWriter(
      actorOf(hybridRow[0]!),
      { title: "Hibrit Yazısı", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    expect(hybridArticle.authorId).toBe(hybrid.id);
  });
});
/**
 * D-071: the area scope used to hold only on the read side. A plain category
 * editor could not open an article outside their areas, but a hand-made POST
 * still let them rewrite it, note on it, or flag it.
 */
describe("a category editor's area scope on writes (D-071)", () => {
  /** An admin, an article in "Tarih & Dünya", and an editor who holds "Sanat & Edebiyat". */
  async function outsiderScenario() {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });

    await setEditorDuties(
      actorOf(admin),
      editor.id,
      { areaId: await areaIdByName("Sanat & Edebiyat"), areaId2: null, isMainEditor: false },
      noMeta,
    );

    const article = await createArticle(
      actorOf(admin),
      { title: "Başka Alanın Yazısı", bodyMarkdown: "Gövde.", category: "Tarih & Dünya" },
      noMeta,
    );

    return { admin: actorOf(admin), editor: actorOf(editor), article };
  }

  it("refuses an update to an article outside the editor's areas", async () => {
    const { editor, article } = await outsiderScenario();

    const error = await captureError(
      updateArticle(editor, article.id, { title: "Ele Geçirildi" }, noMeta),
    );
    expect(error.status).toBe(403);

    const unchanged = await db.select().from(articles).where(eq(articles.id, article.id));
    expect(unchanged[0]!.title).toBe("Başka Alanın Yazısı");
  });

  it("refuses an editorial note and a plagiarism flag outside the editor's areas", async () => {
    const { editor, article } = await outsiderScenario();

    expect((await captureError(addComment(editor, article.id, "Not", noMeta))).status).toBe(403);
    expect(
      (await captureError(setPlagiarismStatus(editor, article.id, "flagged", null, noMeta))).status,
    ).toBe(403);
  });

  it("refuses the version history outside the editor's areas", async () => {
    const { editor, article } = await outsiderScenario();

    const error = await captureError(listArticleVersions(editor, article.id));
    expect(error.status).toBe(403);
  });

  it("refuses to move an article into a category the editor does not hold", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    await setEditorDuties(
      actorOf(admin),
      editor.id,
      { areaId: await areaIdByName("Sanat & Edebiyat"), areaId2: null, isMainEditor: false },
      noMeta,
    );

    const own = await createArticle(
      actorOf(admin),
      { title: "Kendi Alanı", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );

    const error = await captureError(
      updateArticle(
        actorOf(editor),
        own.id,
        { title: "Kendi Alanı", category: "Tarih & Dünya" },
        noMeta,
      ),
    );
    expect(error.status).toBe(403);
  });

  it("lets the editor update an article inside their own areas", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    await setEditorDuties(
      actorOf(admin),
      editor.id,
      { areaId: await areaIdByName("Sanat & Edebiyat"), areaId2: null, isMainEditor: false },
      noMeta,
    );

    const own = await createArticle(
      actorOf(admin),
      { title: "Kendi Alanı", bodyMarkdown: "Gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );

    const updated = await updateArticle(
      actorOf(editor),
      own.id,
      { title: "Düzeltilmiş Başlık", category: "Sanat & Edebiyat" },
      noMeta,
    );
    expect(updated.title).toBe("Düzeltilmiş Başlık");
  });

  it("lets a main editor act on every category", async () => {
    const admin = await createUser({ role: "admin" });
    const mainEditor = await createUser({ role: "editor" });
    await setEditorDuties(
      actorOf(admin),
      mainEditor.id,
      { areaId: null, areaId2: null, isMainEditor: true },
      noMeta,
    );

    const article = await createArticle(
      actorOf(admin),
      { title: "Her Alan", bodyMarkdown: "Gövde.", category: "Tarih & Dünya" },
      noMeta,
    );

    const updated = await updateArticle(
      actorOf(mainEditor),
      article.id,
      { title: "Ana Editör Düzeltti", category: "Tarih & Dünya" },
      noMeta,
    );
    expect(updated.title).toBe("Ana Editör Düzeltti");
  });

  it("keeps a field the form did not send instead of nulling it", async () => {
    const admin = await createUser({ role: "admin" });

    const article = await createArticle(
      actorOf(admin),
      {
        title: "Alanlar Korunur",
        bodyMarkdown: "Gövde.",
        category: "Tarih & Dünya",
        dueDate: "2026-12-31",
      },
      noMeta,
    );

    // Only the title is sent; category and dueDate used to be wiped to null
    const updated = await updateArticle(actorOf(admin), article.id, { title: "Yeni Başlık" }, noMeta);

    expect(updated.title).toBe("Yeni Başlık");
    expect(updated.category).toBe("Tarih & Dünya");
    expect(updated.dueDate).toBe("2026-12-31");
  });
});
