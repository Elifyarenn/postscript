/**
 * How many times an issue was read (D-344): a number per issue and day, the
 * team left out, a closed issue not countable, and nothing about the reader
 * stored.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { issues, issueViewDays } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { createIssue, setIssueStatus } from "@/services/issues";
import { issueViewTotal, recordIssueView, turkeyDay } from "@/services/issue-views";
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

async function issue(status: "published" | "in_production" = "published") {
  const admin = actorOf(await createUser({ role: "admin" }));
  const created = await createIssue(admin, { number: 1, title: "Obsession" }, noMeta);
  await setIssueStatus(admin, created.id, status, noMeta);
  return { admin, issue: created };
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

describe("counting an issue's readings", () => {
  it("adds one per opening to that day's number, and keeps the days apart", async () => {
    const { issue: created } = await issue();
    const monday = new Date("2026-10-19T10:00:00Z");
    const tuesday = new Date("2026-10-20T10:00:00Z");

    await recordIssueView(null, 1, monday);
    await Promise.all([recordIssueView(null, 1, tuesday), recordIssueView(null, 1, tuesday)]);
    const member = actorOf(await createUser({ role: "user" }));
    await recordIssueView(member, 1, tuesday);

    const rows = await db.select().from(issueViewDays).where(eq(issueViewDays.issueId, created.id));
    expect(rows.map((row) => [row.day, row.views]).sort()).toEqual([
      ["2026-10-19", 1],
      ["2026-10-20", 3],
    ]);
    expect(await issueViewTotal(created.id)).toBe(4);
    // A number per day and issue, nothing about who read
    expect(Object.keys(rows[0]!).sort()).toEqual(["day", "issueId", "views"]);
  });

  it("leaves the team's own visits out", async () => {
    const { admin, issue: created } = await issue();
    const editor = actorOf(await createUser({ role: "editor" }));
    expect(await recordIssueView(admin, 1)).toEqual({ counted: false });
    expect(await recordIssueView(editor, 1)).toEqual({ counted: false });
    expect(await issueViewTotal(created.id)).toBe(0);
  });

  it("cannot count, or find, an issue that is not published", async () => {
    await issue("in_production");
    await expectStatus(recordIssueView(null, 1), 404);
    await expectStatus(recordIssueView(null, 9), 404);
    expect(await db.select().from(issueViewDays)).toHaveLength(0);
  });

  it("counts by Turkey's day: just after midnight there is already tomorrow", async () => {
    // 21:30 UTC is 00:30 in Turkey
    expect(turkeyDay(new Date("2026-10-20T21:30:00Z"))).toBe("2026-10-21");
    expect(turkeyDay(new Date("2026-10-20T20:30:00Z"))).toBe("2026-10-20");
  });

  it("goes with its issue", async () => {
    const { issue: created } = await issue();
    await recordIssueView(null, 1);
    await db.delete(issues).where(eq(issues.id, created.id));
    expect(await db.select().from(issueViewDays)).toHaveLength(0);
  });
});
