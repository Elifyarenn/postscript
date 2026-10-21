/**
 * A published issue's page pictures in the CDN (D-343): a public answer is
 * tagged with its issue and page and kept for an hour; closing the issue,
 * taking a page out or changing its picture deletes the CDN's copies at once.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";

const purged = vi.hoisted(() => [] as string[][]);
vi.mock("@vercel/functions", () => ({
  dangerouslyDeleteByTag: async (tags: string[]) => {
    purged.push(tags);
  },
}));

import { db, type Database } from "@/db/client";
import { issues } from "@/db/schema";
import { forgetCachedPictures, issueCacheTag, pageCacheTag } from "@/lib/cdn-cache";
import { addPageImage, listIssuePages, removeIssuePage, replacePageImage } from "@/services/issue-pages";
import { createIssue, setIssueStatus } from "@/services/issues";
import { GET as pictureRoute } from "@/app/api/issue-pages/[id]/media/[mediaId]/route";
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
  purged.length = 0;
  vi.stubEnv("VERCEL", "1");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const png = (colour: string) =>
  sharp({ create: { width: 120, height: 170, channels: 3, background: colour } }).png().toBuffer();

async function publishedIssue() {
  const admin = actorOf(await createUser({ role: "admin" }));
  const issue = await createIssue(admin, { number: 1, title: "Obsession", theme: "Bırakamadıklarımız" }, noMeta);
  await db.update(issues).set({ adminOnly: true }).where(eq(issues.id, issue.id));
  await addPageImage(admin, issue.id, { buffer: await png("#6b1d2f"), fileName: "kapak.png", declaredMime: "image/png" }, noMeta);
  const [page] = await listIssuePages(admin, issue.id);
  await setIssueStatus(admin, issue.id, "published", noMeta);
  purged.length = 0;
  return { admin, issue, page: page!, mediaId: page!.imageUrl!.split("/").pop()! };
}

describe("a published picture's answer", () => {
  it("is kept by the browser and the CDN for an hour, tagged with its issue and page", async () => {
    const { issue, page, mediaId } = await publishedIssue();
    const response = await pictureRoute(new Request(`https://example.test${page.imageUrl}`), {
      params: Promise.resolve({ id: page.id, mediaId }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(response.headers.get("vercel-cdn-cache-control")).toBe("max-age=3600");
    expect(response.headers.get("vercel-cache-tag")).toBe(`${issueCacheTag(issue.id)},${pageCacheTag(page.id)}`);
  });
});

describe("what deletes the CDN's copies", () => {
  it("taking the issue off the air deletes the whole issue's", async () => {
    const { admin, issue } = await publishedIssue();
    await setIssueStatus(admin, issue.id, "in_production", noMeta);
    expect(purged).toEqual([[issueCacheTag(issue.id)]]);
  });

  it("publishing, or any change between unpublished states, deletes nothing", async () => {
    const admin = actorOf(await createUser({ role: "admin" }));
    const issue = await createIssue(admin, { number: 2, title: "İki" }, noMeta);
    await setIssueStatus(admin, issue.id, "in_production", noMeta);
    await setIssueStatus(admin, issue.id, "published", noMeta);
    expect(purged).toEqual([]);
  });

  it("taking a page out, or replacing its picture, deletes that page's", async () => {
    const { admin, page } = await publishedIssue();
    await replacePageImage(admin, page.id, { buffer: await png("#000000"), fileName: "yeni.png", declaredMime: "image/png" }, noMeta);
    expect(purged).toEqual([[pageCacheTag(page.id)]]);

    purged.length = 0;
    await removeIssuePage(admin, page.id, noMeta);
    expect(purged).toEqual([[pageCacheTag(page.id)]]);
  });

  it("sends at most 16 tags at a time, and nothing at all outside Vercel", async () => {
    const tags = Array.from({ length: 20 }, (_, index) => `t-${index}`);
    await forgetCachedPictures(tags);
    expect(purged.map((batch) => batch.length)).toEqual([16, 4]);

    purged.length = 0;
    vi.stubEnv("VERCEL", "");
    await forgetCachedPictures(tags);
    expect(purged).toEqual([]);
  });
});
