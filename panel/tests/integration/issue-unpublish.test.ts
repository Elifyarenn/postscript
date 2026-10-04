/**
 * Taking an issue out of "published" closes it again (D-317): for a signed-in
 * member and a visitor the reader, the page pictures, the tests, the issue page
 * and the public API all answer "not found", whatever status it moves to. The
 * editorial panel keeps its preview.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, type Database } from "@/db/client";
import { issues } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { OBSESSION_QUIZ } from "@/lib/issue-design/issue-01-quizzes";
import { addPageImage, listIssuePages, readIssuePages, readPageMedia } from "@/services/issue-pages";
import { answerQuiz, createQuiz } from "@/services/issue-quizzes";
import { createIssue, setIssueStatus } from "@/services/issues";
import { getPublishedIssue, listPublishedIssues } from "@/services/public";
import { GET as publicIssueRoute } from "@/app/api/public/issues/[number]/route";
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

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

/** Issue 1 as it will be: an admin-only sample with a picture page and a test, then published. */
async function publishedIssue() {
  const admin = actorOf(await createUser({ role: "admin" }));
  const issue = await createIssue(admin, { number: 1, title: "Obsession", theme: "Bırakamadıklarımız" }, noMeta);
  await db.update(issues).set({ adminOnly: true }).where(eq(issues.id, issue.id));
  const png = await sharp({ create: { width: 120, height: 170, channels: 3, background: "#6b1d2f" } }).png().toBuffer();
  await addPageImage(admin, issue.id, { buffer: png, fileName: "kapak.png", declaredMime: "image/png" }, noMeta);
  const [page] = await listIssuePages(admin, issue.id);
  const mediaId = page!.imageUrl!.split("/").pop()!;
  const quizId = await createQuiz(admin, issue.id, OBSESSION_QUIZ, noMeta);
  await setIssueStatus(admin, issue.id, "published", noMeta);
  return { admin, issue, page: page!, mediaId, quizId };
}

const apiStatus = async (number: number) =>
  (await publicIssueRoute(new Request(`https://example.test/api/public/issues/${number}`), {
    params: Promise.resolve({ number: String(number) }),
  })).status;

describe("taking an issue out of published (D-317)", () => {
  it("is open to everyone while published", async () => {
    const s = await publishedIssue();
    const member = actorOf(await createUser({ role: "user" }));
    await expect(readIssuePages(null, 1)).resolves.toBeTruthy();
    await expect(readIssuePages(member, 1)).resolves.toBeTruthy();
    expect((await readPageMedia(null, s.page.id, s.mediaId)).isPublic).toBe(true);
    await expect(getPublishedIssue(1)).resolves.toBeTruthy();
    expect(await apiStatus(1)).toBe(200);
  });

  for (const status of ["planning", "in_production", "archived"] as const) {
    it(`closes the reader, pictures, tests, issue page and API when moved to ${status}`, async () => {
      const s = await publishedIssue();
      await setIssueStatus(s.admin, s.issue.id, status, noMeta);
      const member = actorOf(await createUser({ role: "user" }));
      const writer = actorOf(await createUser({ role: "writer", writerStatus: "active" }));

      for (const actor of [null, member, writer]) {
        await expectStatus(readIssuePages(actor, 1), 404);
        await expectStatus(readPageMedia(actor, s.page.id, s.mediaId), 404);
        await expectStatus(readPageMedia(actor, s.page.id, s.mediaId, 720), 404);
        await expectStatus(answerQuiz(actor, s.quizId, {}), 404);
      }
      // The public route's loader-based check asks the same question
      await expectStatus(readPageMedia(async () => null, s.page.id, s.mediaId), 404);
      await expectStatus(getPublishedIssue(1), 404);
      expect(await listPublishedIssues()).toHaveLength(0);
      expect(await apiStatus(1)).toBe(404);

      // The editorial panel still sees its preview
      const editor = actorOf(await createUser({ role: "editor" }));
      const preview = await readIssuePages(editor, 1);
      expect(preview.preview).toBe(true);
    });
  }
});
