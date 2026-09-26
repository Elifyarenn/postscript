/**
 * The temporary preview of the admin-only issue (D-247): it goes only into the
 * admins' working issue, it reads the drafts without touching them, it puts
 * its seven pages first with working areas and one sample quiz, and running
 * it again updates the same pages instead of adding new ones.
 *
 * The drawing itself is replaced by a stand-in here; the real renderer has its
 * own unit test. What is under test is what the service does with the pages.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issuePages, issueQuizzes, issues, media, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { addPageImage, readIssuePages } from "@/services/issue-pages";
import {
  buildIssuePreview,
  PREVIEW_LABEL_PREFIX,
  PREVIEW_SLOTS,
  SAMPLE_QUIZ_TITLE,
  type PreviewDeps,
} from "@/services/issue-preview";
import { listMedia } from "@/services/media";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, testIssueId } from "../helpers/factories";

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

/** A PNG header just real enough for the type check and the size read. */
function png(tag = 0): Buffer {
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
    Buffer.alloc(64, tag),
  ]);
}

/** Every page drawn from its own transcript, so a changed text is a changed picture. */
function stand(tag = 0): PreviewDeps {
  return {
    render: async (page) => Buffer.concat([png(tag), Buffer.from(page.transcript, "utf8")]),
  };
}

const LONG = Array.from(
  { length: 8 },
  (_, index) => `Paragraf ${index + 1}. Bu cümle yalnızca testin uzunluk ihtiyacı için var ve bir yazıyı taklit etmez.`,
).join("\n\n");

async function makeDrafts() {
  const writer = await createUser({ role: "writer", displayName: "Gerçek Ad" });
  await db.update(users).set({ penName: "Mahlas" }).where(eq(users.id, writer.id));
  const rows = await db
    .insert(articles)
    .values([
      { issueId: await testIssueId(), title: "Bilim İnsanları ve Obsesyon", slug: "bilim", category: "Bilim & Teknoloji", status: "draft", authorId: writer.id, bodyMarkdown: LONG },
      { issueId: await testIssueId(), title: "Madde 1 - Hukukun Peşini Bırakmadıkları", slug: "madde-1", category: "Sosyoloji & Düşünce", status: "in_review", authorId: writer.id, bodyMarkdown: LONG },
      { issueId: await testIssueId(), title: "Üç Kalem", slug: "uc-kalem", category: "Sanat & Edebiyat", status: "accepted", authorId: writer.id, bodyMarkdown: LONG },
    ])
    .returning();
  return rows;
}

async function makeIssue(adminOnly = true) {
  const [issue] = await db
    .insert(issues)
    .values({ number: 1, title: "Obsession", theme: "Bırakamadıklarımız", status: "planning", adminOnly })
    .returning();
  return issue!;
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

describe("where the preview may go", () => {
  it("is the admins' alone", async () => {
    await makeDrafts();
    const issue = await makeIssue();
    const editor = await createUser({ role: "editor" });

    await expectStatus(buildIssuePreview(actorOf(editor), issue.id, noMeta, stand()), 403);
    expect(await db.select().from(issuePages)).toHaveLength(0);
  });

  it("refuses an issue the team can open, so drafts never reach it", async () => {
    await makeDrafts();
    const issue = await makeIssue(false);
    const admin = await createUser({ role: "admin" });

    await expectStatus(buildIssuePreview(actorOf(admin), issue.id, noMeta, stand()), 400);
    expect(await db.select().from(issuePages)).toHaveLength(0);
  });

  it("builds nothing when the drafts it needs are not there", async () => {
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });

    await expectStatus(buildIssuePreview(actorOf(admin), issue.id, noMeta, stand()), 400);
    expect(await db.select().from(issuePages)).toHaveLength(0);
  });

  it("does not take a published text for a draft", async () => {
    const drafts = await makeDrafts();
    await db.update(articles).set({ status: "published" }).where(eq(articles.id, drafts[2]!.id));
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });

    await expectStatus(buildIssuePreview(actorOf(admin), issue.id, noMeta, stand()), 400);
  });
});

describe("the preview", () => {
  it("comes first, reads the drafts without changing them, and wires every area", async () => {
    const drafts = await makeDrafts();
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });
    const before = await db.select().from(articles);

    // A page already in the issue stays, after the preview
    await addPageImage(actorOf(admin), issue.id, { buffer: png(9), fileName: "x.png", declaredMime: "image/png", label: "Gerçek sayfa" }, noMeta);

    const result = await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand());
    expect(result.added).toBe(7);
    expect(result.articles.map((row) => row.id).sort()).toEqual(drafts.map((row) => row.id).sort());

    // Articles: same status, same text, same timestamp
    const after = await db.select().from(articles);
    expect(after).toEqual(before);

    const reader = await readIssuePages(actorOf(admin), issue.number);
    expect(reader.pages.map((page) => page.label)).toEqual([
      ...PREVIEW_SLOTS.map((slot) => `${PREVIEW_LABEL_PREFIX}${slot.label}`),
      "Gerçek sayfa",
    ]);

    // The byline is the one the magazine would print: the pen name
    expect(reader.pages[0]!.transcript).toContain("Mahlas");
    expect(reader.pages[0]!.transcript).not.toContain("Gerçek Ad");

    // Contents jump to the right pages, and the playlist is a link
    const contents = reader.pages[1]!;
    const jumps = contents.hotspots.filter((area) => area.kind === "page").map((area) => area.targetPageId);
    expect(jumps).toEqual([reader.pages[2]!.id, reader.pages[4]!.id, reader.pages[5]!.id, reader.pages[6]!.id]);
    expect(contents.hotspots.some((area) => area.kind === "link" && area.url?.startsWith("https://open.spotify.com/"))).toBe(true);

    // An information box and the sample quiz, reachable and without its answers
    expect(reader.pages[3]!.hotspots.some((area) => area.kind === "info" && area.infoBody)).toBe(true);
    const quizArea = reader.pages[6]!.hotspots.find((area) => area.kind === "quiz");
    expect(quizArea?.quizId).toBeTruthy();
    expect(reader.quizzes).toHaveLength(1);
    expect(reader.quizzes[0]!.title).toBe(SAMPLE_QUIZ_TITLE);
    expect(JSON.stringify(reader.quizzes)).not.toContain("correct");

    // Every area survived to the reader: none was left unfinished
    const all = reader.pages.slice(0, 7).flatMap((page) => page.hotspots);
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("stays closed to everyone but an admin, pictures included", async () => {
    await makeDrafts();
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });
    await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand());

    for (const role of ["editor", "writer", "user"] as const) {
      const person = await createUser({ role });
      await expectStatus(readIssuePages(actorOf(person), issue.number), 404);
    }
    await expectStatus(readIssuePages(null, issue.number), 404);

    // The library does not list an issue's page pictures, not even to an admin
    const pageMedia = await db.select({ id: issuePages.imageMediaId }).from(issuePages);
    const library = await listMedia(actorOf(admin), 500);
    const listed = new Set(library.map((row) => row.id));
    expect(pageMedia.every((row) => row.id && !listed.has(row.id))).toBe(true);
  });

  it("updates in place when run again, and piles nothing up", async () => {
    await makeDrafts();
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });

    await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand());
    const firstIds = (await readIssuePages(actorOf(admin), issue.number)).pages.map((page) => page.id);

    const again = await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand());
    expect(again).toMatchObject({ added: 0, replaced: 0, unchanged: 7 });

    const changed = await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand(7));
    expect(changed).toMatchObject({ added: 0, replaced: 7, unchanged: 0 });

    const reader = await readIssuePages(actorOf(admin), issue.number);
    expect(reader.pages.map((page) => page.id)).toEqual(firstIds);
    expect(await db.select().from(issueQuizzes)).toHaveLength(1);

    // The pictures that were replaced were released, not left behind
    const live = await db.select().from(media).where(isNull(media.deletedAt));
    expect(live).toHaveLength(7);
  });

  it("reuses the old numbered test pages instead of adding beside them", async () => {
    await makeDrafts();
    const issue = await makeIssue();
    const admin = await createUser({ role: "admin" });
    for (const number of [1, 2]) {
      await addPageImage(actorOf(admin), issue.id, { buffer: png(number), fileName: "d.png", declaredMime: "image/png", label: `Deneme sayfası ${number}` }, noMeta);
    }

    const result = await buildIssuePreview(actorOf(admin), issue.id, noMeta, stand());
    expect(result).toMatchObject({ added: 5, replaced: 2 });

    const pages = await db.select().from(issuePages).where(and(eq(issuePages.issueId, issue.id)));
    expect(pages).toHaveLength(7);
    expect(pages.some((page) => page.label?.startsWith("Deneme"))).toBe(false);
  });
});
