/**
 * The magazine's pages (D-234): who may read an issue, that a draft is refused
 * at the data layer rather than merely hidden, that laying pages out is the
 * admin's, that ordering stays dense, and that linking an article never
 * touches the article.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, issuePages, issues } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import {
  addIssuePage,
  duplicateIssuePage,
  listIssuePages,
  moveIssuePage,
  readIssuePages,
  removeIssuePage,
  updateIssuePage,
} from "@/services/issue-pages";
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
