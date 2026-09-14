/**
 * The profile page's category column (D-113).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { articles } from "@/db/schema";
import { listCategoryCounts } from "@/services/public";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";

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

let counter = 0;

async function article(category: string | null, options: { status?: "published" | "draft"; deleted?: boolean } = {}) {
  counter += 1;
  await db.insert(articles).values({
    title: `Yazı ${counter}`,
    slug: `kategori-yazi-${counter}`,
    category,
    bodyMarkdown: "x",
    status: options.status ?? "published",
    publishedAt: new Date(),
    deletedAt: options.deleted ? new Date() : null,
  });
}

describe("listCategoryCounts", () => {
  it("counts published articles per category, most first, then by name", async () => {
    await article("Sanat");
    await article("Psikoloji");
    await article("Psikoloji");
    await article("Bilim");

    expect(await listCategoryCounts()).toEqual([
      { category: "Psikoloji", count: 2 },
      { category: "Bilim", count: 1 },
      { category: "Sanat", count: 1 },
    ]);
  });

  it("leaves out drafts, deleted articles and articles without a category", async () => {
    await article("Sanat", { status: "draft" });
    await article("Sanat", { deleted: true });
    await article(null);

    expect(await listCategoryCounts()).toEqual([]);
  });
});
