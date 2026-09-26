/**
 * The magazine without a session (D-257): published issues and articles are
 * public, everything else stays closed — drafts, scheduled articles and the
 * admins' working issue, pictures included — and the sitemap lists exactly
 * what a stranger may open.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { articles, issues } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { addPageImage, listIssuePages, readIssuePages, readPageMedia } from "@/services/issue-pages";
import { getPublicArticle, listRecentArticles } from "@/services/public";
import sitemap from "@/app/sitemap";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;
const storage = new MemoryStorageAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setStorageAdapter(storage);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

async function makeIssue(number: number, values: { status: "planning" | "published"; adminOnly?: boolean }) {
  const [issue] = await db
    .insert(issues)
    .values({
      number,
      title: `Sayı ${number}`,
      status: values.status,
      adminOnly: values.adminOnly ?? false,
      publishedAt: values.status === "published" ? new Date() : null,
    })
    .returning({ id: issues.id, number: issues.number });
  return issue!;
}

async function makeArticle(slug: string, status: "published" | "draft" | "scheduled", issueId: string | null = null) {
  await db.insert(articles).values({
    title: slug,
    slug,
    bodyMarkdown: "Gövde.",
    status,
    issueId,
    publishedAt: status === "published" ? new Date() : null,
  });
}

/** A PNG header is all the page upload checks; the pixels are never decoded. */
function png(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1240, 0);
  ihdr.writeUInt32BE(1754, 4);
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

async function pageWithPicture(issueId: string) {
  const admin = await createUser({ role: "admin" });
  await addPageImage(
    actorOf(admin),
    issueId,
    { buffer: png(), fileName: "sayfa.png", declaredMime: "image/png" },
    noMeta,
  );
  const [page] = await listIssuePages(actorOf(admin), issueId);
  return { pageId: page!.id, mediaId: page!.imageUrl!.split("/").pop()! };
}

describe("a published issue without a session", () => {
  it("opens, pictures included", async () => {
    const issue = await makeIssue(1, { status: "published" });
    const { pageId, mediaId } = await pageWithPicture(issue.id);

    const reader = await readIssuePages(null, 1);
    expect(reader.preview).toBe(false);
    expect(reader.pages).toHaveLength(1);
    const file = await readPageMedia(null, pageId, mediaId);
    expect(file.mime).toBe("image/png");
  });

  it("keeps a draft issue and its pictures closed", async () => {
    const issue = await makeIssue(2, { status: "planning" });
    const { pageId, mediaId } = await pageWithPicture(issue.id);

    await expectStatus(readIssuePages(null, 2), 404);
    await expectStatus(readPageMedia(null, pageId, mediaId), 404);
  });

  it("keeps the admins' working issue closed even when it is marked published", async () => {
    const issue = await makeIssue(3, { status: "published", adminOnly: true });
    const { pageId, mediaId } = await pageWithPicture(issue.id);

    await expectStatus(readIssuePages(null, 3), 404);
    await expectStatus(readPageMedia(null, pageId, mediaId), 404);
  });
});

describe("a page picture whose file is missing", () => {
  it("answers 404, not a server error (D-257)", async () => {
    const issue = await makeIssue(8, { status: "published" });
    const { pageId, mediaId } = await pageWithPicture(issue.id);
    storage.clear();

    await expectStatus(readPageMedia(null, pageId, mediaId), 404);
  });
});

describe("articles without a session", () => {
  it("shows a published article and nothing unpublished", async () => {
    await makeArticle("yayinda", "published");
    await makeArticle("taslak", "draft");
    await makeArticle("planli", "scheduled");

    await expect(getPublicArticle("yayinda")).resolves.toMatchObject({ slug: "yayinda" });
    await expectStatus(getPublicArticle("taslak"), 404);
    await expectStatus(getPublicArticle("planli"), 404);
    expect((await listRecentArticles()).map((row) => row.slug)).toEqual(["yayinda"]);
  });

  it("never shows an article from the admins' working issue", async () => {
    const working = await makeIssue(4, { status: "planning", adminOnly: true });
    await makeArticle("ornek-yazi", "published", working.id);

    await expectStatus(getPublicArticle("ornek-yazi"), 404);
    expect(await listRecentArticles()).toHaveLength(0);
  });
});

describe("sitemap", () => {
  it("lists the magazine and every public issue and article, nothing else", async () => {
    const open = await makeIssue(5, { status: "published" });
    const working = await makeIssue(6, { status: "published", adminOnly: true });
    await makeIssue(7, { status: "planning" });
    await makeArticle("acik-yazi", "published", open.id);
    await makeArticle("gizli-yazi", "published", working.id);
    await makeArticle("taslak-yazi", "draft");

    const paths = (await sitemap()).map((entry) => new URL(entry.url).pathname);
    expect(paths).toEqual(
      expect.arrayContaining(["/", "/magazine", "/magazine/issues", "/kvkk", "/magazine/issues/5", "/magazine/articles/acik-yazi"]),
    );
    expect(paths).not.toContain("/magazine/issues/6");
    expect(paths).not.toContain("/magazine/issues/7");
    expect(paths).not.toContain("/magazine/articles/gizli-yazi");
    expect(paths).not.toContain("/magazine/articles/taslak-yazi");
  });
});
