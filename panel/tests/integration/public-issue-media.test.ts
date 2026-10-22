/**
 * Published issue pictures straight from R2 (D-353): copies exist only for an
 * issue anyone may open, go the moment it closes or a page leaves it, and the
 * reader uses a public address only for a picture the manifest lists. Off
 * unless the environment says otherwise.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("@vercel/functions", () => ({ dangerouslyDeleteByTag: async () => undefined }));

import type { Database } from "@/db/client";
import { resetEnvCache } from "@/lib/env";
import { pageSrcSet } from "@/lib/issue-page-variants";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { addPageImage, listIssuePages, readIssuePages, removeIssuePage } from "@/services/issue-pages";
import { createIssue, setIssueStatus } from "@/services/issues";
import { reconcileAllPublicMedia, reconcilePublicIssueMedia, resetPublicManifestCache } from "@/services/public-issue-media";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

const CDN = "https://cdn.example.test";
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
  storage.clear();
  resetPublicManifestCache();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

function switchOn({ serving = true }: { serving?: boolean } = {}) {
  vi.stubEnv("S3_PUBLIC_BUCKET", "postscript-public");
  vi.stubEnv("PUBLIC_MEDIA_URL", serving ? CDN : "");
  resetEnvCache();
}

const png = (colour: string) =>
  sharp({ create: { width: 900, height: 1270, channels: 3, background: colour } }).png().toBuffer();

const publicKeys = () =>
  [...storage.objects.keys()].filter((id) => id.startsWith("public:")).map((id) => id.slice("public:".length)).sort();

/** An issue with two picture pages, published or not. */
async function issueWithPages(publish: boolean) {
  const admin = actorOf(await createUser({ role: "admin" }));
  const issue = await createIssue(admin, { number: 1, title: "Obsession", theme: "Bırakamadıklarımız" }, noMeta);
  for (const colour of ["#6b1d2f", "#2f1015"]) {
    await addPageImage(admin, issue.id, { buffer: await png(colour), fileName: "sayfa.png", declaredMime: "image/png" }, noMeta);
  }
  if (publish) await setIssueStatus(admin, issue.id, "published", noMeta);
  return { admin, issue, pages: await listIssuePages(admin, issue.id) };
}

describe("switched off (the default)", () => {
  it("copies nothing and keeps every picture on the guarded route", async () => {
    await issueWithPages(true);
    expect(publicKeys()).toEqual([]);
    const reader = await readIssuePages(null, 1);
    expect(reader.pages.every((page) => page.imageUrl?.startsWith("/api/issue-pages/"))).toBe(true);
  });
});

describe("copying and serving switched on", () => {
  it("copies a published issue's pictures with their smaller copies and serves them from R2", async () => {
    switchOn();
    const { issue, pages } = await issueWithPages(true);

    // Two pictures, each with the 720 and 1280 copies (the original stands in for a PNG)
    expect(publicKeys()).toHaveLength(6);
    expect(publicKeys().every((key) => key.startsWith(`issues/${issue.id}/`))).toBe(true);

    const reader = await readIssuePages(null, 1);
    const first = reader.pages[0]!;
    expect(first.imageUrl).toBe(`${CDN}/issues/${issue.id}/${pages[0]!.id}/${first.imageUrl!.split("/").pop()}`);
    expect(pageSrcSet(first.imageUrl!, 900)).toContain(`${first.imageUrl}.w720 720w`);
  });

  it("copies nothing for an issue that is not published, or only the admins', and serves it guarded", async () => {
    switchOn();
    const { admin, issue } = await issueWithPages(false);
    expect(await reconcilePublicIssueMedia(issue.id)).toEqual({ added: 0, removed: 0, pending: 0 });
    expect(publicKeys()).toEqual([]);
    const reader = await readIssuePages(admin, 1);
    expect(reader.pages.every((page) => page.imageUrl?.startsWith("/api/issue-pages/"))).toBe(true);
  });

  it("takes every copy back the moment the issue is closed", async () => {
    switchOn();
    const { admin, issue } = await issueWithPages(true);
    expect(publicKeys()).toHaveLength(6);

    await setIssueStatus(admin, issue.id, "archived", noMeta);
    expect(publicKeys()).toEqual([]);
  });

  it("takes a removed page's copies back and leaves the others", async () => {
    switchOn();
    const { admin, issue, pages } = await issueWithPages(true);
    await removeIssuePage(admin, pages[0]!.id, noMeta);

    expect(publicKeys()).toHaveLength(3);
    expect(publicKeys().every((key) => key.startsWith(`issues/${issue.id}/${pages[1]!.id}/`))).toBe(true);
  });

  it("keeps a picture on the guarded route until the manifest lists it", async () => {
    switchOn();
    const { issue } = await issueWithPages(true);
    await storage.remove({ bucket: "media", key: `public-manifests/${issue.id}.json` });
    resetPublicManifestCache();

    const reader = await readIssuePages(null, 1);
    expect(reader.pages.every((page) => page.imageUrl?.startsWith("/api/issue-pages/"))).toBe(true);

    // The daily run writes it again from what is there
    await reconcileAllPublicMedia();
    resetPublicManifestCache();
    expect((await readIssuePages(null, 1)).pages[0]!.imageUrl!.startsWith(CDN)).toBe(true);
  });

  it("puts back a copy that went missing from the bucket", async () => {
    switchOn();
    const { issue } = await issueWithPages(true);
    const [lost] = publicKeys();
    await storage.remove({ bucket: "public", key: lost! });

    expect(await reconcilePublicIssueMedia(issue.id)).toEqual({ added: 1, removed: 0, pending: 0 });
    expect(publicKeys()).toHaveLength(6);
  });
});

describe("copying on, serving off", () => {
  it("copies but keeps the reader on the guarded route", async () => {
    switchOn({ serving: false });
    await issueWithPages(true);
    expect(publicKeys()).toHaveLength(6);
    const reader = await readIssuePages(null, 1);
    expect(reader.pages.every((page) => page.imageUrl?.startsWith("/api/issue-pages/"))).toBe(true);
  });
});
