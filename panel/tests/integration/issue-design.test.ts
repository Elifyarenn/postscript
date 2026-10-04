/**
 * Importing the designers' pages from code (D-274): only into the admins'
 * working issue, pictures stored and read back before anything older is
 * taken out, the older pages kept in a snapshot that puts them back exactly,
 * and a rerun that changes only what changed.
 *
 * The pictures are small real WebP files and the manifest is a test one; the
 * shipped manifest and pictures have their own unit test.
 */
import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, issuePageHotspots, issuePages, issueQuizzes, issues, media } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { OBSESSION_QUIZ } from "@/lib/issue-design/issue-01-quizzes";
import { designKeyOf, type DesignManifest, type RenderRecord } from "@/lib/issue-design/manifest";
import { getStorage, MemoryStorageAdapter } from "@/lib/storage";
import { addPageImage, readIssuePages, readPageMedia, saveHotspots } from "@/services/issue-pages";
import { importIssueDesign, pendingSnapshot, restoreIssueDesignSnapshot, type DesignDeps } from "@/services/issue-design";
import { answerQuiz } from "@/services/issue-quizzes";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  (getStorage() as MemoryStorageAdapter).clear();
});

const colours: Record<string, string> = { kapak: "#6b1d2f", "bolum-a": "#2f1015", "bolum-b": "#dcd0c4", arka: "#e6ddd2" };

async function webp(colour: string): Promise<Buffer> {
  return sharp({ create: { width: 120, height: 170, channels: 3, background: colour } }).webp().toBuffer();
}

function testManifest(keys = ["kapak", "bolum-a", "bolum-b", "arka"], areas: DesignManifest["pages"][number]["areas"] = []): DesignManifest {
  return {
    issueNumber: 1,
    folder: "test",
    renderWidth: 2480,
    trim: { x: 0, y: 0 },
    pages: keys.map((key, index) => ({
      key,
      source: "test.ai",
      sourcePage: index + 1,
      printedNumber: null,
      role: key === "kapak" ? "cover" : key === "arka" ? "back_cover" : "page",
      title: `Sayfa ${key}`,
      contents: key.startsWith("bolum") ? `Bölüm ${key}` : null,
      alt: `Görsel ${key}`,
      transcript: null,
      areas: key === "kapak" ? areas : [],
    })),
    excluded: [],
  };
}

/** Deps built from the given pictures; renders.json is computed from them. */
async function depsFor(manifest: DesignManifest, override: Partial<Record<string, string>> = {}): Promise<DesignDeps> {
  const files = new Map<string, Buffer>();
  for (const entry of manifest.pages) files.set(`${entry.key}.webp`, await webp(override[entry.key] ?? colours[entry.key] ?? "#123456"));
  const renders: RenderRecord[] = manifest.pages.map((entry) => {
    const bytes = files.get(`${entry.key}.webp`)!;
    return {
      key: entry.key,
      source: entry.source,
      sourcePage: entry.sourcePage,
      sourceSha256: "0".repeat(64),
      file: `${entry.key}.webp`,
      width: 120,
      height: 170,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      quality: 90,
    };
  });
  return {
    manifestFor: (number) => (number === manifest.issueNumber ? manifest : null),
    readRenders: () => renders,
    readAsset: (_folder, file) => files.get(file)!,
  };
}

async function makeIssue(adminOnly = true) {
  const [issue] = await db
    .insert(issues)
    .values({ number: 1, title: "Obsession", theme: "Bırakamadıklarımız", status: "planning", adminOnly })
    .returning();
  return issue!;
}

/** The temporary preview the import replaces: two pictures with areas and a template page. */
async function oldPreview(issueId: string, admin: ReturnType<typeof actorOf>) {
  const first = await addPageImage(admin, issueId, { buffer: await webp("#ffffff"), fileName: "a.webp", declaredMime: "image/webp", label: "Geçici tasarım · Kapak" }, noMeta);
  const second = await addPageImage(admin, issueId, { buffer: await webp("#000000"), fileName: "b.webp", declaredMime: "image/webp", label: "Geçici tasarım · İçindekiler" }, noMeta);
  await saveHotspots(admin, second.id, [{ kind: "page", name: "Kapağa dön", x: 0.1, y: 0.1, w: 0.2, h: 0.1, targetPageId: first.id }], noMeta);
  await db.insert(issuePages).values({ issueId, position: 3, template: "editorial", tocTitle: "Editörden", heading: "Yazılmış bir başlık" });
  return { first, second };
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

const storedKeys = () => [...(getStorage() as MemoryStorageAdapter).objects.keys()];

describe("where the import may go", () => {
  it("is the admins' alone, and only into the admin-only issue", async () => {
    const issue = await makeIssue();
    const other = await db.insert(issues).values({ number: 2, title: "İki", status: "planning" }).returning();
    const deps = await depsFor(testManifest());
    const editor = await createUser({ role: "editor" });
    const admin = await createUser({ role: "admin" });

    await expectStatus(importIssueDesign(actorOf(editor), issue.id, noMeta, deps), 403);
    await expectStatus(importIssueDesign(actorOf(admin), other[0]!.id, noMeta, deps), 400);
    expect(await db.select().from(issuePages)).toHaveLength(0);
    expect(storedKeys()).toHaveLength(0);
  });

  it("writes nothing when a picture does not match its record", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    await oldPreview(issue.id, admin);
    const manifest = testManifest();
    const deps = await depsFor(manifest);
    const broken: DesignDeps = { ...deps, readAsset: (folder, file) => (file === "bolum-b.webp" ? Buffer.from("x") : deps.readAsset(folder, file)) };

    await expectStatus(importIssueDesign(admin, issue.id, noMeta, broken), 400);
    const labels = (await db.select().from(issuePages)).map((row) => row.label);
    expect(labels.filter((label) => designKeyOf(label))).toHaveLength(0);
    expect(labels).toContain("Geçici tasarım · Kapak");
  });

  it("does not invent a quiz the issue does not have", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const manifest = testManifest(undefined, [
      { kind: "quiz", name: "Test", rect: [0.1, 0.1, 0.2, 0.2], quizTitle: "Olmayan test" },
    ]);
    await expectStatus(importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest)), 400);
    expect(await db.select().from(issuePages)).toHaveLength(0);
  });
});

describe("the first import", () => {
  it("puts the design in the manifest's order and sets the older pages aside", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const old = await oldPreview(issue.id, admin);
    const oldMedia = await db.select().from(media);

    const result = await importIssueDesign(admin, issue.id, noMeta, await depsFor(testManifest()));
    expect(result).toMatchObject({ pages: 4, added: 4, replaced: 0, unchanged: 0, retired: 3 });

    const reader = await readIssuePages(admin, 1);
    expect(reader.pages.map((entry) => designKeyOf(entry.label))).toEqual(["kapak", "bolum-a", "bolum-b", "arka"]);
    expect(reader.pages.map((entry) => entry.template)).toEqual(["cover", "full_bleed", "full_bleed", "back_cover"]);
    expect(reader.pages.filter((entry) => entry.inContents).map((entry) => entry.tocTitle)).toEqual(["Bölüm bolum-a", "Bölüm bolum-b"]);
    expect(reader.pages.every((entry) => entry.imageWidth === 120 && entry.imageHeight === 170)).toBe(true);

    // The older pictures stay, so the snapshot can put them back
    for (const row of oldMedia) {
      const [still] = await db.select().from(media).where(eq(media.id, row.id));
      expect(still!.deletedAt).toBeNull();
    }
    expect(await db.select().from(issuePages).where(eq(issuePages.id, old.first.id))).toHaveLength(0);
    expect(storedKeys().some((key) => key.includes("issue-pages/snapshots/"))).toBe(true);
    expect((await pendingSnapshot(issue.id))?.count).toBe(3);
  });

  it("stays closed to everyone but an admin: reader and pictures", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(testManifest()));
    const [first] = await db.select().from(issuePages).where(eq(issuePages.position, 1));

    const picture = await readPageMedia(admin, first!.id, first!.imageMediaId!);
    expect(picture.mime).toBe("image/webp");

    for (const role of ["editor", "writer", "user"] as const) {
      const actor = actorOf(await createUser({ role }));
      await expectStatus(readIssuePages(actor, 1), 404);
      await expectStatus(readPageMedia(actor, first!.id, first!.imageMediaId!), 404);
    }
    await expectStatus(readIssuePages(null, 1), 404);
    await expectStatus(readPageMedia(null, first!.id, first!.imageMediaId!), 404);

    const [row] = await db.select().from(issues).where(eq(issues.id, issue.id));
    expect(row!.status).toBe("planning");
    expect(row!.publishedAt).toBeNull();
  });

  it("puts the areas the manifest names, with jumps by page", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const [quiz] = await db.insert(issueQuizzes).values({ issueId: issue.id, kind: "knowledge", title: "Sayının testi" }).returning();
    const manifest = testManifest(undefined, [
      { kind: "page", name: "Bölüm A'ya git", rect: [0.1, 0.1, 0.3, 0.1], target: "bolum-a" },
      { kind: "quiz", name: "Testi aç", rect: [0.1, 0.5, 0.3, 0.1], quizTitle: "Sayının testi" },
    ]);
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));

    const pages = await db.select().from(issuePages).orderBy(issuePages.position);
    const areas = await db.select().from(issuePageHotspots).where(eq(issuePageHotspots.pageId, pages[0]!.id)).orderBy(issuePageHotspots.position);
    expect(areas.map((area) => area.kind)).toEqual(["page", "quiz"]);
    expect(areas[0]!.targetPageId).toBe(pages[1]!.id);
    expect(areas[1]!.quizId).toBe(quiz!.id);
  });
});

describe("a quiz the manifest carries (D-297)", () => {
  it("is written into the issue, bound to its area, and rewritten rather than doubled by a rerun", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const manifest: DesignManifest = {
      ...testManifest(undefined, [
        { kind: "quiz", name: "Testi çöz", rect: [0.1, 0.5, 0.3, 0.1], showMarker: true, quizTitle: OBSESSION_QUIZ.title },
      ]),
      quizzes: [OBSESSION_QUIZ],
    };
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));

    const [quiz] = await db.select().from(issueQuizzes);
    expect(quiz!.kind).toBe("persona");
    const pages = await db.select().from(issuePages).orderBy(issuePages.position);
    const [area] = await db.select().from(issuePageHotspots).where(eq(issuePageHotspots.pageId, pages[0]!.id));
    expect(area!.quizId).toBe(quiz!.id);

    // Changed in the panel, then imported again: the code's text comes back, in the same row
    await db.update(issueQuizzes).set({ intro: "Panelde eklendi" }).where(eq(issueQuizzes.id, quiz!.id));
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));
    const after = await db.select().from(issueQuizzes);
    expect(after).toHaveLength(1);
    expect(after[0]!.id).toBe(quiz!.id);
    expect(after[0]!.intro).toBeNull();
    const [again] = await db.select().from(issuePageHotspots).where(eq(issuePageHotspots.pageId, pages[0]!.id));
    expect(again!.quizId).toBe(quiz!.id);
  });
});

describe("a quiz page (D-309)", () => {
  it("replaces the hidden area: a page of its own after the opener, every question in the reader's copy, marked on the server", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const area = { kind: "quiz" as const, name: "Testi çöz", rect: [0.1, 0.5, 0.3, 0.1] as [number, number, number, number], quizTitle: OBSESSION_QUIZ.title };
    // Imported once the old way, with the quiz behind an area on the cover
    await importIssueDesign(admin, issue.id, noMeta, await depsFor({ ...testManifest(undefined, [area]), quizzes: [OBSESSION_QUIZ] }));

    const manifest: DesignManifest = {
      ...testManifest(),
      quizzes: [OBSESSION_QUIZ],
      quizPages: [
        { key: "test", after: "bolum-a", title: "Test", contents: "Test", section: "Eğlence", quizTitle: OBSESSION_QUIZ.title },
      ],
    };
    const result = await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));
    expect(result).toMatchObject({ pages: 5, added: 1, retired: 0 });
    expect(await db.select().from(issuePageHotspots)).toEqual([]);

    const [quiz] = await db.select().from(issueQuizzes);
    const reader = await readIssuePages(admin, 1);
    expect(reader.pages.map((entry) => designKeyOf(entry.label))).toEqual(["kapak", "bolum-a", "test", "bolum-b", "arka"]);
    const page = reader.pages[2]!;
    expect(page.imageUrl).toBeNull();
    expect(page.section).toBe("Eğlence");
    expect(page.tocTitle).toBe("Test");
    expect(page.blocks).toEqual([{ kind: "test", quizId: quiz!.id }]);

    // The reader is handed the quiz the page lays out, all five questions, no key
    const copy = reader.quizzes.find((entry) => entry.id === quiz!.id)!;
    expect(copy.questions).toHaveLength(5);
    expect(JSON.stringify(copy)).not.toMatch(/outcomeId|monica|nina|beth/);

    // Every first option is Monica's: the page's answers come back as her result
    const answers = Object.fromEntries(copy.questions.map((question) => [question.id, question.options[0]!.id]));
    const marked = await answerQuiz(admin, quiz!.id, answers);
    expect(marked).toMatchObject({ kind: "persona", answered: 5, total: 5 });
    expect(marked.kind === "persona" && marked.outcome?.title).toMatch(/Monica/);

    // A rerun keeps the same page, does not add another
    const again = await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));
    expect(again).toMatchObject({ pages: 5, added: 0, unchanged: 5 });
    const pages = await db.select().from(issuePages);
    expect(pages).toHaveLength(5);
    expect(pages.find((entry) => entry.id === page.id)).toBeDefined();
  });
});

describe("running it again", () => {
  it("changes nothing when nothing changed: no new rows, no new files", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const deps = await depsFor(testManifest());
    await importIssueDesign(admin, issue.id, noMeta, deps);
    const mediaCount = (await db.select().from(media)).length;
    const files = storedKeys().length;

    const again = await importIssueDesign(admin, issue.id, noMeta, deps);
    const third = await importIssueDesign(admin, issue.id, noMeta, deps);
    expect(again).toMatchObject({ added: 0, replaced: 0, unchanged: 4, retired: 0, dropped: 0 });
    expect(third).toMatchObject({ unchanged: 4 });
    expect(await db.select().from(issuePages)).toHaveLength(4);
    expect(await db.select().from(media)).toHaveLength(mediaCount);
    expect(storedKeys()).toHaveLength(files);
  });

  it("replaces a changed picture and releases the old file", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const manifest = testManifest();
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest));
    const [before] = await db.select().from(issuePages).where(eq(issuePages.position, 2));

    const result = await importIssueDesign(admin, issue.id, noMeta, await depsFor(manifest, { "bolum-a": "#00ff00" }));
    expect(result).toMatchObject({ replaced: 1, unchanged: 3 });
    const [after] = await db.select().from(issuePages).where(eq(issuePages.id, before!.id));
    expect(after!.imageMediaId).not.toBe(before!.imageMediaId);
    const [released] = await db.select().from(media).where(eq(media.id, before!.imageMediaId!));
    expect(released!.deletedAt).not.toBeNull();
    expect(storedKeys().filter((key) => key.includes("/bolum-a-"))).toHaveLength(1);
  });

  it("follows the manifest's new order and drops a page taken out of it", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(testManifest()));

    const result = await importIssueDesign(admin, issue.id, noMeta, await depsFor(testManifest(["kapak", "bolum-b", "arka"])));
    expect(result).toMatchObject({ dropped: 1, unchanged: 3, retired: 0 });
    const reader = await readIssuePages(admin, 1);
    expect(reader.pages.map((entry) => designKeyOf(entry.label))).toEqual(["kapak", "bolum-b", "arka"]);
    expect(reader.pages.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });
});

describe("undo", () => {
  it("puts the older pages back with their ids, pictures and areas", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const old = await oldPreview(issue.id, admin);
    const deps = await depsFor(testManifest());
    await importIssueDesign(admin, issue.id, noMeta, deps);

    const result = await restoreIssueDesignSnapshot(admin, issue.id, noMeta);
    expect(result).toEqual({ restored: 3, removed: 4 });

    const reader = await readIssuePages(admin, 1);
    expect(reader.pages.map((entry) => entry.id)).toEqual([old.first.id, old.second.id, reader.pages[2]!.id]);
    expect(reader.pages[2]!.heading).toBe("Yazılmış bir başlık");
    expect(reader.pages[1]!.hotspots[0]!.targetPageId).toBe(old.first.id);
    const picture = await readPageMedia(admin, old.first.id, reader.pages[0]!.imageUrl!.split("/").pop()!);
    expect(picture.body.length).toBeGreaterThan(0);

    // Undone once; a second undo has nothing to do
    expect(await pendingSnapshot(issue.id)).toBeNull();
    await expectStatus(restoreIssueDesignSnapshot(admin, issue.id, noMeta), 400);

    // And the design comes back from code, setting the same pages aside again
    const again = await importIssueDesign(admin, issue.id, noMeta, deps);
    expect(again).toMatchObject({ added: 4, retired: 3 });
    const live = await db.select().from(media).where(and(isNull(media.deletedAt)));
    expect(live.filter((row) => row.storageKey.startsWith("issue-pages/design/"))).toHaveLength(4);
  });

  it("is the admins' alone", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    await oldPreview(issue.id, admin);
    await importIssueDesign(admin, issue.id, noMeta, await depsFor(testManifest()));
    const editor = actorOf(await createUser({ role: "editor" }));
    await expectStatus(restoreIssueDesignSnapshot(editor, issue.id, noMeta), 403);
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "issue_design.previous_pages_restored"))).length).toBe(0);
  });
});

describe("the smaller copies a phone reads (D-313)", () => {
  it("are uploaded beside each original and served for ?w=, behind the same checks", async () => {
    const issue = await makeIssue();
    const admin = actorOf(await createUser({ role: "admin" }));
    const deps = await depsFor(testManifest());
    const copy = await webp("#aaaaaa");
    // Only the cover has a 720 copy; every other width and page has none
    const withCopy: DesignDeps = {
      ...deps,
      readAsset: (folder, file) => (file === "kapak.w720.webp" ? copy : deps.readAsset(folder, file)),
    };
    await importIssueDesign(admin, issue.id, noMeta, withCopy);

    expect(storedKeys().filter((key) => /\.w720\.webp$/.test(key))).toHaveLength(1);
    const [cover] = await db.select().from(issuePages).where(eq(issuePages.position, 1));

    const small = await readPageMedia(admin, cover!.id, cover!.imageMediaId!, 720);
    expect(small.body.equals(copy)).toBe(true);
    expect(small.mime).toBe("image/webp");

    // No 1280 copy: the original answers
    const original = await readPageMedia(admin, cover!.id, cover!.imageMediaId!);
    const wide = await readPageMedia(admin, cover!.id, cover!.imageMediaId!, 1280);
    expect(wide.body.equals(original.body)).toBe(true);

    // A width changes nothing about who may look
    const reader = actorOf(await createUser({ role: "user" }));
    await expectStatus(readPageMedia(reader, cover!.id, cover!.imageMediaId!, 720), 404);
    await expectStatus(readPageMedia(null, cover!.id, cover!.imageMediaId!, 720), 404);
  });
});
