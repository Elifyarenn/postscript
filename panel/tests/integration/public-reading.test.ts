/**
 * The reading screen's search box and category links, and the about page's
 * list of writers (D-112).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, users } from "@/db/schema";
import { listPublicAuthors, listPublicStaff, listRecentArticles } from "@/services/public";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser } from "../helpers/factories";

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

let slugCounter = 0;

async function article(values: {
  title: string;
  summary?: string;
  category?: string;
  authorId?: string;
  status?: "published" | "draft";
  deleted?: boolean;
}) {
  slugCounter += 1;
  await db.insert(articles).values({
    title: values.title,
    slug: `yazi-${slugCounter}`,
    summary: values.summary ?? null,
    category: values.category ?? null,
    authorId: values.authorId ?? null,
    bodyMarkdown: "x",
    status: values.status ?? "published",
    publishedAt: new Date(Date.now() - slugCounter * 1000),
    deletedAt: values.deleted ? new Date() : null,
  });
}

async function author(penName: string | null, penNameSlug: string | null) {
  const user = await createUser();
  await db.update(users).set({ penName, penNameSlug }).where(eq(users.id, user.id));
  return user;
}

const titles = (rows: { title: string }[]) => rows.map((row) => row.title).sort();

describe("listRecentArticles filters", () => {
  it("narrows to one writing area by its exact name", async () => {
    await article({ title: "Bir", category: "Psikoloji" });
    await article({ title: "İki", category: "Sanat" });
    await article({ title: "Üç" });

    expect(titles(await listRecentArticles(20, { category: "Psikoloji" }))).toEqual(["Bir"]);
    expect(await listRecentArticles(20)).toHaveLength(3);
  });

  it("finds the search words in the title or the summary, whatever the case", async () => {
    await article({ title: "Obsesyon Uzerine" });
    await article({ title: "Kayip Mektuplar", summary: "Bir obsesyon hikayesi" });
    await article({ title: "Baska Bir Sey" });

    expect(titles(await listRecentArticles(20, { query: "OBSESYON" }))).toEqual([
      "Kayip Mektuplar",
      "Obsesyon Uzerine",
    ]);
  });

  it("takes a typed wildcard literally", async () => {
    await article({ title: "Yuzde 100% gercek" });
    await article({ title: "1000 gun" });

    expect(titles(await listRecentArticles(20, { query: "100%" }))).toEqual(["Yuzde 100% gercek"]);
    expect(await listRecentArticles(20, { query: "_" })).toHaveLength(0);
  });

  it("never shows a draft or a deleted article, filtered or not", async () => {
    await article({ title: "Taslak yazi", status: "draft" });
    await article({ title: "Silinmis yazi", deleted: true });

    expect(await listRecentArticles(20, { query: "yazi" })).toHaveLength(0);
  });

  it("reads a malformed filter as no filter", async () => {
    await article({ title: "Bir" });
    await article({ title: "İki" });

    expect(await listRecentArticles(20, { query: 5 })).toHaveLength(2);
    expect(await listRecentArticles(20, "kategori")).toHaveLength(2);
  });
});

describe("listPublicAuthors", () => {
  it("lists pen names with a published article, once each, in order", async () => {
    const zeynep = await author("Zeynep K.", "zeynep-k");
    const ada = await author("Ada Y.", "ada-y");
    await article({ title: "Bir", authorId: zeynep.id });
    await article({ title: "İki", authorId: zeynep.id });
    await article({ title: "Üç", authorId: ada.id });

    expect(await listPublicAuthors()).toEqual([
      { name: "Ada Y.", slug: "ada-y" },
      { name: "Zeynep K.", slug: "zeynep-k" },
    ]);
  });

  it("leaves out writers with only drafts, without a pen name, or deleted", async () => {
    const drafter = await author("Taslakci", "taslakci");
    const legalOnly = await author(null, null);
    const gone = await author("Giden", "giden");
    await article({ title: "Bir", authorId: drafter.id, status: "draft" });
    await article({ title: "İki", authorId: legalOnly.id });
    await article({ title: "Üç", authorId: gone.id });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));

    expect(await listPublicAuthors()).toEqual([]);
  });
});

describe("listPublicStaff (D-135)", () => {
  async function member(
    role: "user" | "writer" | "editor",
    values: { penName?: string; slug?: string; username?: string; banned?: boolean; suspended?: boolean; deleted?: boolean } = {},
  ) {
    const status = values.suspended ? "suspended" : "active";
    const created = await createUser({
      role,
      writerStatus: role === "writer" ? status : null,
      editorStatus: role === "editor" ? status : null,
      isBanned: values.banned ?? false,
    });
    await db
      .update(users)
      .set({
        penName: values.penName ?? null,
        penNameSlug: values.slug ?? null,
        username: values.username ?? null,
        deletedAt: values.deleted ? new Date() : null,
      })
      .where(eq(users.id, created.id));
    return created;
  }

  it("lists writers by pen name, or by handle without one, whether or not they have published", async () => {
    await member("writer", { penName: "Zeynep K.", slug: "zeynep-k" });
    await member("writer", { username: "ada_yazar" });
    await member("editor", { penName: "Editör E.", slug: "editor-e" });

    expect(await listPublicStaff("writer")).toEqual([
      { name: "@ada_yazar", href: "/social/u/ada_yazar" },
      { name: "Zeynep K.", href: "/magazine/authors/zeynep-k" },
    ]);
    expect(await listPublicStaff("editor")).toEqual([
      { name: "Editör E.", href: "/magazine/authors/editor-e" },
    ]);
  });

  it("leaves out readers and banned, suspended, deleted or nameless accounts", async () => {
    await member("user", { penName: "Okur", slug: "okur" });
    await member("writer", { penName: "Yasakli", slug: "yasakli", banned: true });
    await member("writer", { penName: "Askida", slug: "askida", suspended: true });
    await member("writer", { penName: "Giden", slug: "giden-yazar", deleted: true });
    await member("writer");

    expect(await listPublicStaff("writer")).toEqual([]);
  });
});
