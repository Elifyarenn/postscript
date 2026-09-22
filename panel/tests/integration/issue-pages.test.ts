/**
 * The magazine's pages (D-234, D-236): who may read an issue, that a draft and
 * the admins' working issue are refused at the data layer rather than merely
 * hidden, that laying pages out is the admin's, that ordering stays dense and
 * survives a reload, that replacing a picture keeps the areas drawn on it, and
 * that linking an article never touches the article.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issuePages, issues, media } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import {
  addIssuePage,
  addPageImage,
  duplicateIssuePage,
  listIssuePages,
  moveIssuePage,
  readIssuePages,
  readPageMedia,
  removeIssuePage,
  reorderIssuePages,
  replacePageImage,
  saveHotspots,
  updateIssuePage,
  updatePageMeta,
} from "@/services/issue-pages";
import { listIssues } from "@/services/issues";
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
});

async function makeIssue(status: "planning" | "published" = "planning", number = 1) {
  const [issue] = await db
    .insert(issues)
    .values({ number, title: "Obsession", theme: "OBSESSION", status })
    .returning({ id: issues.id, number: issues.number });
  return issue!;
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

describe("who may open an issue", () => {
  it("refuses a draft to a reader at the data layer, not just in the page", async () => {
    const reader = await createUser({ role: "user" });
    const issue = await makeIssue("planning");
    await addIssuePage(actorOf(await createUser({ role: "admin" })), issue.id, { template: "cover" }, noMeta);

    // The same answer a missing issue gives, so nothing is confirmed to exist
    await expectStatus(readIssuePages(actorOf(reader), issue.number), 404);
    await expectStatus(readIssuePages(null, issue.number), 404);
  });

  it("opens a draft to the editorial panel, marked as a preview", async () => {
    const editor = await createUser({ role: "editor" });
    const issue = await makeIssue("planning");

    const reader = await readIssuePages(actorOf(editor), issue.number);
    expect(reader.preview).toBe(true);
  });

  it("opens a published issue to any signed-in reader", async () => {
    const person = await createUser({ role: "user" });
    const issue = await makeIssue("published", 2);

    const reader = await readIssuePages(actorOf(person), issue.number);
    expect(reader.preview).toBe(false);
    expect(reader.issue.theme).toBe("OBSESSION");
  });
});

describe("laying an issue out", () => {
  it("is the admin's, not an editor's", async () => {
    const editor = await createUser({ role: "editor" });
    const issue = await makeIssue();
    await expectStatus(addIssuePage(actorOf(editor), issue.id, { template: "cover" }, noMeta), 403);
  });

  it("adds pages in order and keeps the numbers dense when one is removed", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();

    for (const template of ["cover", "editorial", "contents"] as const) {
      await addIssuePage(actorOf(admin), issue.id, { template }, noMeta);
    }
    let pages = await listIssuePages(actorOf(admin), issue.id);
    expect(pages.map((page) => page.position)).toEqual([1, 2, 3]);

    await removeIssuePage(actorOf(admin), pages[1]!.id, noMeta);
    pages = await listIssuePages(actorOf(admin), issue.id);
    // No gap where the removed page was
    expect(pages.map((page) => page.position)).toEqual([1, 2]);
    expect(pages.map((page) => page.template)).toEqual(["cover", "contents"]);
  });

  it("moves a page one step and does nothing at the edges", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    for (const template of ["cover", "editorial", "contents"] as const) {
      await addIssuePage(actorOf(admin), issue.id, { template }, noMeta);
    }

    const before = await listIssuePages(actorOf(admin), issue.id);
    await moveIssuePage(actorOf(admin), before[2]!.id, "up", noMeta);
    expect((await listIssuePages(actorOf(admin), issue.id)).map((page) => page.template)).toEqual([
      "cover",
      "contents",
      "editorial",
    ]);

    // Already first: a no-op, not an error
    const now = await listIssuePages(actorOf(admin), issue.id);
    await moveIssuePage(actorOf(admin), now[0]!.id, "up", noMeta);
    expect((await listIssuePages(actorOf(admin), issue.id)).map((page) => page.template)).toEqual([
      "cover",
      "contents",
      "editorial",
    ]);
  });

  it("copies a page to the end without carrying its article link", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const issue = await makeIssue();
    const [article] = await db
      .insert(articles)
      .values({ title: "Saplantı", slug: "saplanti", authorId: writer.id, status: "draft" })
      .returning({ id: articles.id });

    await addIssuePage(
      actorOf(admin),
      issue.id,
      { template: "article_opening", heading: "Saplantı", articleId: article!.id },
      noMeta,
    );
    const [source] = await listIssuePages(actorOf(admin), issue.id);
    await duplicateIssuePage(actorOf(admin), source!.id, noMeta);

    const pages = await listIssuePages(actorOf(admin), issue.id);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.heading).toBe("Saplantı");
    // Two pages claiming one article in the contents is a mistake more often
    // than not, so the copy starts unlinked
    expect(pages[1]!.article).toBeNull();
  });

  it("keeps what was typed even when the layout is changed afterwards", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    await addIssuePage(actorOf(admin), issue.id, { template: "article_opening", heading: "Başlık" }, noMeta);
    const [page] = await listIssuePages(actorOf(admin), issue.id);

    await updateIssuePage(actorOf(admin), page!.id, { template: "full_bleed", heading: "Başlık" }, noMeta);
    const [after] = await listIssuePages(actorOf(admin), issue.id);
    expect(after!.template).toBe("full_bleed");
    expect(after!.heading).toBe("Başlık");
  });

  it("refuses a layout that is not in the catalogue", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    await expectStatus(addIssuePage(actorOf(admin), issue.id, { template: "poster" }, noMeta), 400);
  });
});

describe("linking an article", () => {
  it("leaves the article's text and status exactly where they were", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const issue = await makeIssue();
    const [article] = await db
      .insert(articles)
      .values({
        title: "Saplantı",
        slug: "saplanti",
        authorId: writer.id,
        status: "in_review",
        bodyMarkdown: "Gövde metni.",
      })
      .returning({ id: articles.id });

    await addIssuePage(actorOf(admin), issue.id, { template: "article_opening", articleId: article!.id }, noMeta);

    const [after] = await db.select().from(articles).where(eq(articles.id, article!.id));
    expect(after!.status).toBe("in_review");
    expect(after!.bodyMarkdown).toBe("Gövde metni.");
  });

  it("keeps an unpublished article's words out of a reader's copy", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const issue = await makeIssue("published", 3);
    const [article] = await db
      .insert(articles)
      .values({
        title: "Henüz yayımlanmadı",
        slug: "henuz",
        authorId: writer.id,
        status: "in_review",
        bodyMarkdown: "Gizli gövde.",
      })
      .returning({ id: articles.id });

    await addIssuePage(actorOf(admin), issue.id, { template: "article_opening", articleId: article!.id }, noMeta);

    const reader = await readIssuePages(actorOf(await createUser({ role: "user" })), issue.number);
    const page = reader.pages[0]!;
    // The page may name it, but an article in review is not the reader's yet
    expect(page.article?.title).toBe("Henüz yayımlanmadı");
    expect(page.article?.body).toBeNull();
    expect(page.article?.slug).toBeNull();
  });
});

describe("interaction blocks", () => {
  it("stores the blocks a page carries and drops anything unreadable", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    await addIssuePage(
      actorOf(admin),
      issue.id,
      {
        template: "interactive",
        blocks: [
          { kind: "quote", text: "Bırakamadıklarımız.", source: "P.S." },
          { kind: "quiz", question: "Soru?", options: ["A", "B"], answer: 1, explanation: "" },
        ],
      },
      noMeta,
    );

    const [page] = await listIssuePages(actorOf(admin), issue.id);
    expect(page!.blocks).toHaveLength(2);
    expect(page!.blocks[0]).toMatchObject({ kind: "quote", text: "Bırakamadıklarımız." });

    // Something written straight into the column by hand is ignored on the way out
    await db
      .update(issuePages)
      .set({ blocks: [{ kind: "nonsense" }, { kind: "quote", text: "Kalan", source: "" }] })
      .where(eq(issuePages.id, page!.id));
    const [again] = await listIssuePages(actorOf(admin), issue.id);
    expect(again!.blocks).toHaveLength(1);
    expect(again!.blocks[0]).toMatchObject({ kind: "quote", text: "Kalan" });
  });

  it("refuses a block the catalogue does not know", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    await expectStatus(
      addIssuePage(actorOf(admin), issue.id, { template: "interactive", blocks: [{ kind: "iframe" }] }, noMeta),
      400,
    );
  });
});

/* ------------------------------------------------------------------ */
/* The working issue, and the designed pages on it (D-236)             */
/* ------------------------------------------------------------------ */

/** A PNG header just real enough for the type check and the size read. */
function png(width = 1240, height = 1754): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(13, 0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    length,
    Buffer.from("IHDR", "ascii"),
    ihdr,
    Buffer.alloc(64),
  ]);
}

async function makeAdminOnlyIssue(number = 9) {
  const [issue] = await db
    .insert(issues)
    .values({ number, title: "Obsession", theme: "OBSESSION", status: "planning", adminOnly: true })
    .returning({ id: issues.id, number: issues.number });
  return issue!;
}

describe("the working issue is the admins' alone", () => {
  it("is refused to an editor, a writer, a reader and a stranger, at the data layer", async () => {
    const issue = await makeAdminOnlyIssue();
    const admin = await createUser({ role: "admin" });
    await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "kapak.png", declaredMime: "image/png" },
      noMeta,
    );

    // Not "hidden in the page": the same 404 a missing issue gives
    await expectStatus(readIssuePages(actorOf(await createUser({ role: "editor" })), issue.number), 404);
    await expectStatus(
      readIssuePages(actorOf(await createUser({ role: "writer", writerStatus: "active" })), issue.number),
      404,
    );
    await expectStatus(readIssuePages(actorOf(await createUser({ role: "user" })), issue.number), 404);
    await expectStatus(readIssuePages(null, issue.number), 404);

    const reader = await readIssuePages(actorOf(admin), issue.number);
    expect(reader.issue.adminOnly).toBe(true);
    expect(reader.pages).toHaveLength(1);
  });

  it("stays closed even after it is published", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeAdminOnlyIssue(10);
    await db.update(issues).set({ status: "published" }).where(eq(issues.id, issue.id));

    // A signed-in reader may open any published issue — except this one
    await expectStatus(readIssuePages(actorOf(await createUser({ role: "user" })), issue.number), 404);
    await expect(readIssuePages(actorOf(admin), issue.number)).resolves.toBeTruthy();
  });

  it("keeps its pictures closed to everyone the issue is closed to", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const issue = await makeAdminOnlyIssue(11);
    await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "kapak.png", declaredMime: "image/png" },
      noMeta,
    );
    const [page] = await listIssuePages(actorOf(admin), issue.id);
    const mediaId = page!.imageUrl!.split("/").pop()!;

    await expectStatus(readPageMedia(actorOf(editor), page!.id, mediaId), 404);
    await expectStatus(readPageMedia(null, page!.id, mediaId), 404);
    const file = await readPageMedia(actorOf(admin), page!.id, mediaId);
    expect(file.mime).toBe("image/png");
  });

  it("does not let a page be used as a door into the media library", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 12);
    await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "kapak.png", declaredMime: "image/png" },
      noMeta,
    );
    const [page] = await listIssuePages(actorOf(admin), issue.id);

    // A real media row, but not one this page uses
    const [other] = await db
      .insert(media)
      .values({ storageKey: "media/other.png", mime: "image/png", size: 10, licenseType: "own_work" })
      .returning({ id: media.id });
    await expectStatus(readPageMedia(actorOf(admin), page!.id, other!.id), 404);
  });

  it("is left out of the panel's issue list for an editor", async () => {
    await makeAdminOnlyIssue(13);
    await makeIssue("planning", 14);

    const forEditor = await listIssues(actorOf(await createUser({ role: "editor" })));
    expect(forEditor.map((issue) => issue.number)).toEqual([14]);

    const forAdmin = await listIssues(actorOf(await createUser({ role: "admin" })));
    expect(forAdmin.map((issue) => issue.number).sort()).toEqual([13, 14]);
  });
});

describe("taking delivered pages in", () => {
  it("stores the picture, reads its size and makes a page at the end", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();

    const first = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(1240, 1754), fileName: "01.png", declaredMime: "image/png", label: "Kapak" },
      noMeta,
    );
    const second = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(1240, 1754), fileName: "02.png", declaredMime: "image/png" },
      noMeta,
    );

    expect(first.position).toBe(1);
    expect(second.position).toBe(2);
    expect(first.width).toBe(1240);
    expect(first.height).toBe(1754);

    const pages = await listIssuePages(actorOf(admin), issue.id);
    expect(pages.map((page) => page.label)).toEqual(["Kapak", null]);
    expect(pages[0]!.imageUrl).toContain(`/api/issue-pages/${pages[0]!.id}/media/`);
  });

  it("refuses what is not one of the three page formats, on the bytes", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();

    // A PDF calling itself a PNG: the name is not the file
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n", "ascii"), Buffer.alloc(32)]);
    await expectStatus(
      addPageImage(
        actorOf(admin),
        issue.id,
        { buffer: pdf, fileName: "sayfa.png", declaredMime: "image/png" },
        noMeta,
      ),
      400,
    );
    // And nothing was written to the issue
    expect(await listIssuePages(actorOf(admin), issue.id)).toHaveLength(0);
  });

  it("is the admin's, not an editor's", async () => {
    const editor = await createUser({ role: "editor" });
    const issue = await makeIssue();
    await expectStatus(
      addPageImage(
        actorOf(editor),
        issue.id,
        { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
        noMeta,
      ),
      403,
    );
  });

  it("keeps the areas when the picture is replaced, and says when the shape changed", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(1000, 1400), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await saveHotspots(
      actorOf(admin),
      page.id,
      [{ kind: "link", url: "https://example.test", x: 0.1, y: 0.1, w: 0.3, h: 0.2, name: "Spotify" }],
      noMeta,
    );

    const same = await replacePageImage(
      actorOf(admin),
      page.id,
      { buffer: png(2000, 2800), fileName: "01-buyuk.png", declaredMime: "image/png" },
      noMeta,
    );
    expect(same.aspectChanged).toBe(false);

    const changed = await replacePageImage(
      actorOf(admin),
      page.id,
      { buffer: png(1400, 1000), fileName: "01-yatay.png", declaredMime: "image/png" },
      noMeta,
    );
    expect(changed.aspectChanged).toBe(true);

    // The work is the areas, not the file: both replacements kept them
    const [after] = await listIssuePages(actorOf(admin), issue.id);
    expect(after!.hotspots).toHaveLength(1);
    expect(after!.hotspots[0]!.name).toBe("Spotify");
    expect(after!.imageWidth).toBe(1400);
  });
});

describe("the whole order at once", () => {
  it("writes a dragged order and survives being read back", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    for (const name of ["a", "b", "c"]) {
      await addPageImage(
        actorOf(admin),
        issue.id,
        { buffer: png(), fileName: `${name}.png`, declaredMime: "image/png", label: name },
        noMeta,
      );
    }
    const before = await listIssuePages(actorOf(admin), issue.id);
    const reversed = [...before].reverse().map((page) => page.id);

    await reorderIssuePages(actorOf(admin), issue.id, reversed, noMeta);

    const after = await listIssuePages(actorOf(admin), issue.id);
    expect(after.map((page) => page.label)).toEqual(["c", "b", "a"]);
    expect(after.map((page) => page.position)).toEqual([1, 2, 3]);
  });

  it("refuses an order that is not exactly the issue's pages", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    for (const name of ["a", "b"]) {
      await addPageImage(
        actorOf(admin),
        issue.id,
        { buffer: png(), fileName: `${name}.png`, declaredMime: "image/png" },
        noMeta,
      );
    }
    const pages = await listIssuePages(actorOf(admin), issue.id);

    await expectStatus(reorderIssuePages(actorOf(admin), issue.id, [pages[0]!.id], noMeta), 400);
    await expectStatus(
      reorderIssuePages(actorOf(admin), issue.id, [pages[0]!.id, pages[0]!.id], noMeta),
      400,
    );
  });
});

describe("clickable areas", () => {
  it("saves a set: new ones added, known ones kept, missing ones removed", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await saveHotspots(
      actorOf(admin),
      page.id,
      [
        { kind: "link", url: "https://example.test", x: 0.1, y: 0.1, w: 0.2, h: 0.1, name: "Bir" },
        { kind: "info", infoTitle: "Not", infoBody: "Bir not", x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
      ],
      noMeta,
    );
    let [saved] = await listIssuePages(actorOf(admin), issue.id);
    expect(saved!.hotspots).toHaveLength(2);

    const keep = saved!.hotspots[0]!;
    await saveHotspots(
      actorOf(admin),
      page.id,
      [{ id: keep.id, kind: "link", url: "https://example.test/2", x: 0.1, y: 0.1, w: 0.2, h: 0.1, name: "Bir" }],
      noMeta,
    );
    [saved] = await listIssuePages(actorOf(admin), issue.id);
    expect(saved!.hotspots).toHaveLength(1);
    // The same area, kept by its id, so anything bound to it stays bound
    expect(saved!.hotspots[0]!.id).toBe(keep.id);
    expect(saved!.hotspots[0]!.url).toBe("https://example.test/2");
  });

  it("refuses an address that could run in a reader's browser", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await expectStatus(
      saveHotspots(
        actorOf(admin),
        page.id,
        [{ kind: "link", url: "javascript:alert(1)", x: 0, y: 0, w: 0.2, h: 0.2 }],
        noMeta,
      ),
      400,
    );
  });

  it("refuses a rectangle that runs off the page", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await expectStatus(
      saveHotspots(
        actorOf(admin),
        page.id,
        [{ kind: "info", infoTitle: "x", x: 0.9, y: 0.1, w: 0.3, h: 0.1 }],
        noMeta,
      ),
      400,
    );
  });

  it("will not let a jump point outside its own issue", async () => {
    const admin = await createUser({ role: "admin" });
    const here = await makeIssue("planning", 20);
    const elsewhere = await makeIssue("planning", 21);
    const page = await addPageImage(
      actorOf(admin),
      here.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );
    const stranger = await addPageImage(
      actorOf(admin),
      elsewhere.id,
      { buffer: png(), fileName: "02.png", declaredMime: "image/png" },
      noMeta,
    );

    await expectStatus(
      saveHotspots(
        actorOf(admin),
        page.id,
        [{ kind: "page", targetPageId: stranger.id, x: 0, y: 0, w: 0.2, h: 0.2 }],
        noMeta,
      ),
      400,
    );
  });

  it("keeps a jump pointing at the same page after the issue is reordered", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const first = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png", label: "bir" },
      noMeta,
    );
    const target = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "02.png", declaredMime: "image/png", label: "iki" },
      noMeta,
    );

    await saveHotspots(
      actorOf(admin),
      first.id,
      [{ kind: "page", targetPageId: target.id, x: 0.2, y: 0.2, w: 0.2, h: 0.1 }],
      noMeta,
    );
    await reorderIssuePages(actorOf(admin), issue.id, [target.id, first.id], noMeta);

    const pages = await listIssuePages(actorOf(admin), issue.id);
    const moved = pages.find((page) => page.id === first.id)!;
    expect(moved.position).toBe(2);
    // The position changed; the target did not
    expect(moved.hotspots[0]!.targetPageId).toBe(target.id);
  });

  it("hands a reader only the areas that lead somewhere", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 22);
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await saveHotspots(
      actorOf(admin),
      page.id,
      [
        { kind: "link", url: "https://example.test", x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
        // A quiz area with nothing chosen yet: real in the panel, not for a reader
        { kind: "quiz", quizId: null, x: 0.5, y: 0.5, w: 0.2, h: 0.1 },
      ],
      noMeta,
    );

    const panel = await listIssuePages(actorOf(admin), issue.id);
    expect(panel[0]!.hotspots).toHaveLength(2);
    expect(panel[0]!.hotspots.filter((area) => area.ready)).toHaveLength(1);

    const reader = await readIssuePages(actorOf(await createUser({ role: "user" })), issue.number);
    expect(reader.pages[0]!.hotspots).toHaveLength(1);
    expect(reader.pages[0]!.hotspots[0]!.kind).toBe("link");
  });

  it("is the admin's to draw", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await expectStatus(
      saveHotspots(
        actorOf(editor),
        page.id,
        [{ kind: "info", infoTitle: "x", x: 0, y: 0, w: 0.2, h: 0.2 }],
        noMeta,
      ),
      403,
    );
  });
});

describe("what the page list edits", () => {
  it("saves the label, the alternative text and what the page is", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );

    await updatePageMeta(
      actorOf(admin),
      page.id,
      {
        label: "Kapak",
        imageAlt: "OBSESSION yazılı kapak",
        tocTitle: "Kapak",
        inContents: false,
        template: "cover",
        transcript: "OBSESSION — Bırakamadıklarımız",
      },
      noMeta,
    );

    const [saved] = await listIssuePages(actorOf(admin), issue.id);
    expect(saved).toMatchObject({
      label: "Kapak",
      imageAlt: "OBSESSION yazılı kapak",
      template: "cover",
      inContents: false,
      transcript: "OBSESSION — Bırakamadıklarımız",
    });
  });
});
