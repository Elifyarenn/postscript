/**
 * The issue blurb (D-148): the paragraph the magazines design prints on a card.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { issues } from "@/db/schema";
import { createIssue, findIssue, updateIssue } from "@/services/issues";
import { listPublishedIssues } from "@/services/public";
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

const blurb = "Bazı insanlar aklınızda sonsuza dek kalır. İstediğiniz için değil, elinizde olmadığı için.";

describe("issue blurb (D-148)", () => {
  it("keeps the paragraph the admin wrote, and lets it be cleared", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await createIssue(actorOf(admin), { number: 1, title: "Obsession", blurb }, noMeta);
    expect(issue.blurb).toBe(blurb);

    const cleared = await updateIssue(
      actorOf(admin),
      issue.id,
      { number: 1, title: "Obsession" },
      noMeta,
    );
    expect(cleared.blurb).toBeNull();
    expect((await findIssue(issue.id)).blurb).toBeNull();
  });

  it("gives the paragraph to the reader's issue list once the issue is published", async () => {
    const admin = await createUser({ role: "admin" });
    const issue = await createIssue(actorOf(admin), { number: 2, title: "Obsession", blurb }, noMeta);
    await db
      .update(issues)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(issues.id, issue.id));

    const published = await listPublishedIssues();
    expect(published).toHaveLength(1);
    expect(published[0]?.blurb).toBe(blurb);
  });

  it("refuses a paragraph longer than the form allows", async () => {
    const admin = await createUser({ role: "admin" });
    const tooLong = "x".repeat(601);
    await expect(
      createIssue(actorOf(admin), { number: 3, title: "Obsession", blurb: tooLong }, noMeta),
    ).rejects.toThrow();
  });
});
