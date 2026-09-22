/**
 * The quizzes an issue carries (D-236): who may write one, who may answer one,
 * that the answer key never leaves the server, and that an unfinished quiz
 * refuses to produce a result rather than inventing one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { issues } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { answerQuiz, createQuiz, listQuizzes, removeQuiz, updateQuiz } from "@/services/issue-quizzes";
import { addPageImage, listIssuePages, readIssuePages, saveHotspots } from "@/services/issue-pages";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";
import type { Actor } from "@/lib/auth/rbac";

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

async function makeIssue(
  status: "planning" | "published" = "published",
  number = 1,
  adminOnly = false,
) {
  const [issue] = await db
    .insert(issues)
    .values({ number, title: "Obsession", theme: "OBSESSION", status, adminOnly })
    .returning({ id: issues.id, number: issues.number });
  return issue!;
}

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

/** Puts a page in the issue with one area that opens the quiz. */
async function bindQuizToPage(actor: Actor, issueId: string, quizId: string) {
  const page = await addPageImage(
    actor,
    issueId,
    { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
    noMeta,
  );
  await saveHotspots(
    actor,
    page.id,
    [{ kind: "quiz", quizId, x: 0.1, y: 0.1, w: 0.2, h: 0.1, name: "Testi çöz" }],
    noMeta,
  );
  return page;
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

const knowledge = {
  kind: "knowledge" as const,
  title: "Sayı testi",
  intro: "Kısa bir test.",
  questions: [
    {
      id: "q1",
      text: "Sayının teması?",
      explanation: "Kapakta yazıyor.",
      options: [
        { id: "a", text: "Obsession", correct: true },
        { id: "b", text: "Başka", correct: false },
      ],
    },
  ],
  outcomes: [],
};

const scored = {
  kind: "scored" as const,
  title: "Hangi okursun?",
  intro: null,
  questions: [
    {
      id: "s1",
      text: "Sabah mı akşam mı?",
      options: [
        { id: "a", text: "Sabah", points: 1 },
        { id: "b", text: "Akşam", points: 3 },
      ],
    },
  ],
  outcomes: [
    { id: "low", title: "Sakin", body: null, min: 1, max: 2 },
    { id: "high", title: "Tutkulu", body: "Bırakamıyorsun.", min: 3, max: 3 },
  ],
};

describe("writing a quiz", () => {
  it("is the admin's, not an editor's", async () => {
    const issue = await makeIssue();
    await expectStatus(
      createQuiz(actorOf(await createUser({ role: "editor" })), issue.id, knowledge, noMeta),
      403,
    );
  });

  it("stores both kinds and reports what is still missing", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();

    await createQuiz(actorOf(admin), issue.id, knowledge, noMeta);
    await createQuiz(actorOf(admin), issue.id, scored, noMeta);

    const list = await listQuizzes(actorOf(admin), issue.id);
    expect(list).toHaveLength(2);
    expect(list.every((quiz) => quiz.problems.length === 0)).toBe(true);
  });

  it("keeps an unfinished quiz but never calls it ready", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const id = await createQuiz(
      actorOf(admin),
      issue.id,
      { ...knowledge, questions: [] },
      noMeta,
    );

    const [saved] = await listQuizzes(actorOf(admin), issue.id);
    expect(saved!.id).toBe(id);
    expect(saved!.problems).toContain("Testte hiç soru yok.");
  });

  it("drops the outcome bands of a quiz that is no longer scored", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    const id = await createQuiz(actorOf(admin), issue.id, scored, noMeta);

    await updateQuiz(actorOf(admin), id, { ...knowledge, title: "Artık bilgi testi" }, noMeta);
    const [saved] = await listQuizzes(actorOf(admin), issue.id);
    expect(saved!.kind).toBe("knowledge");
    expect(saved!.outcomes).toEqual([]);
  });

  it("refuses a question with a single option", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue();
    await expectStatus(
      createQuiz(
        actorOf(admin),
        issue.id,
        {
          ...knowledge,
          questions: [{ id: "q1", text: "Tek", options: [{ id: "a", text: "A", correct: true }] }],
        },
        noMeta,
      ),
      400,
    );
  });
});

describe("answering a quiz", () => {
  it("marks a knowledge quiz and explains it, without ever sending the key", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser({ role: "user" });
    const issue = await makeIssue("published", 2);
    const id = await createQuiz(actorOf(admin), issue.id, knowledge, noMeta);

    // A quiz no page opens is not part of the reader's copy of the issue
    const unreached = await readIssuePages(actorOf(reader), issue.number);
    expect(unreached.quizzes).toHaveLength(0);

    await bindQuizToPage(actorOf(admin), issue.id, id);
    const seen = await readIssuePages(actorOf(reader), issue.number);
    expect(seen.quizzes).toHaveLength(1);
    // What the browser receives has no answers in it at all
    expect(JSON.stringify(seen.quizzes)).not.toContain("correct");
    expect(JSON.stringify(seen.quizzes)).not.toContain("Kapakta yazıyor");

    const right = await answerQuiz(actorOf(reader), id, { q1: "a" });
    if (right.kind !== "knowledge") throw new Error("wrong kind");
    expect(right.correctCount).toBe(1);
    expect(right.answers[0]!.explanation).toBe("Kapakta yazıyor.");

    const wrong = await answerQuiz(actorOf(reader), id, { q1: "b" });
    if (wrong.kind !== "knowledge") throw new Error("wrong kind");
    expect(wrong.correctCount).toBe(0);
    expect(wrong.answers[0]!.correctId).toBe("a");
  });

  it("adds a scored quiz up and names the band", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 3);
    const id = await createQuiz(actorOf(admin), issue.id, scored, noMeta);

    const result = await answerQuiz(actorOf(await createUser({ role: "user" })), id, { s1: "b" });
    if (result.kind !== "scored") throw new Error("wrong kind");
    expect(result.score).toBe(3);
    expect(result.outcome?.title).toBe("Tutkulu");
  });

  it("refuses to mark a quiz that cannot produce an honest result", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 4);
    const id = await createQuiz(actorOf(admin), issue.id, { ...knowledge, questions: [] }, noMeta);

    await expectStatus(answerQuiz(actorOf(await createUser({ role: "user" })), id, {}), 400);
  });

  it("is closed to anyone the issue is closed to", async () => {
    const admin = await createUser({ role: "admin" });
    const closed = await makeIssue("planning", 5, true);
    const id = await createQuiz(actorOf(admin), closed.id, knowledge, noMeta);

    // Knowing the id is not a way in
    await expectStatus(answerQuiz(actorOf(await createUser({ role: "editor" })), id, { q1: "a" }), 404);
    await expectStatus(answerQuiz(actorOf(await createUser({ role: "user" })), id, { q1: "a" }), 404);
    await expectStatus(answerQuiz(null, id, { q1: "a" }), 404);
    await expect(answerQuiz(actorOf(admin), id, { q1: "a" })).resolves.toBeTruthy();
  });

  it("is closed while the issue it belongs to is still a draft", async () => {
    const admin = await createUser({ role: "admin" });
    const draft = await makeIssue("planning", 6);
    const id = await createQuiz(actorOf(admin), draft.id, knowledge, noMeta);

    await expectStatus(answerQuiz(actorOf(await createUser({ role: "user" })), id, { q1: "a" }), 404);
    // The editorial panel previews its own draft, so an editor may try it
    await expect(
      answerQuiz(actorOf(await createUser({ role: "editor" })), id, { q1: "a" }),
    ).resolves.toBeTruthy();
  });
});

describe("a quiz bound to a page", () => {
  it("can be opened from more than one area without being written twice", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 7);
    const id = await createQuiz(actorOf(admin), issue.id, knowledge, noMeta);

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
        { kind: "quiz", quizId: id, x: 0.1, y: 0.1, w: 0.2, h: 0.1, name: "Testi çöz" },
        { kind: "quiz", quizId: id, x: 0.6, y: 0.6, w: 0.2, h: 0.1, name: "Yine testi çöz" },
      ],
      noMeta,
    );

    const [saved] = await listIssuePages(actorOf(admin), issue.id);
    expect(saved!.hotspots.map((area) => area.quizId)).toEqual([id, id]);
    expect(await listQuizzes(actorOf(admin), issue.id)).toHaveLength(1);
  });

  it("leaves the area behind, unfinished, when the quiz is removed", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await makeIssue("published", 8);
    const id = await createQuiz(actorOf(admin), issue.id, knowledge, noMeta);

    const page = await addPageImage(
      actorOf(admin),
      issue.id,
      { buffer: png(), fileName: "01.png", declaredMime: "image/png" },
      noMeta,
    );
    await saveHotspots(
      actorOf(admin),
      page.id,
      [{ kind: "quiz", quizId: id, x: 0.1, y: 0.1, w: 0.2, h: 0.1 }],
      noMeta,
    );

    await removeQuiz(actorOf(admin), id, noMeta);

    const [saved] = await listIssuePages(actorOf(admin), issue.id);
    // The rectangle survives so the editor can see what lost its target; the
    // reader is never shown it
    expect(saved!.hotspots).toHaveLength(1);
    expect(saved!.hotspots[0]!.ready).toBe(false);

    const reader = await readIssuePages(actorOf(await createUser({ role: "user" })), issue.number);
    expect(reader.pages[0]!.hotspots).toHaveLength(0);
  });
});
