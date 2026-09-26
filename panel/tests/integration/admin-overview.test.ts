/**
 * The admin dashboard's pending work counts (D-097): each one must match the
 * queue its page lists, and the overdue count must use the 5651 window.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { articles, contentReports, writerApplications } from "@/db/schema";
import { pendingAdminWork } from "@/services/admin-overview";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, testIssueId } from "../helpers/factories";

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

const HOUR = 60 * 60_000;

async function addReport(reporterId: string, createdAt: Date, status: "open" | "removed" = "open") {
  await db.insert(contentReports).values({
    reporterId,
    targetType: "member",
    targetId: reporterId,
    category: "spam",
    snapshot: "@ornek",
    status,
    createdAt,
  });
}

describe("pendingAdminWork", () => {
  it("counts only what is waiting on the admin", async () => {
    const admin = await createUser({ role: "admin" });
    const member = await createUser();
    const now = new Date();

    // Two open reports, one of them past the 24 hours; one already decided
    await addReport(member.id, new Date(now.getTime() - 2 * HOUR));
    await addReport(member.id, new Date(now.getTime() - 25 * HOUR));
    await addReport(member.id, new Date(now.getTime() - 30 * HOUR), "removed");

    // Only the editor-approved application is the admin's turn. A member may
    // hold one open application at a time, so each stage gets its own applicant
    const [first, second, third] = await Promise.all([createUser(), createUser(), createUser()]);
    await db.insert(writerApplications).values([
      { userId: first.id, status: "submitted" },
      { userId: second.id, status: "editor_approved" },
      { userId: third.id, status: "admin_approved" },
    ]);

    // Only the undeleted article in the publication queue counts
    await db.insert(articles).values([
      { issueId: await testIssueId(), title: "Kuyrukta", slug: "kuyrukta", status: "ready_for_publishing" },
      { issueId: await testIssueId(), title: "Silinmiş", slug: "silinmis", status: "ready_for_publishing", deletedAt: now },
      { issueId: await testIssueId(), title: "İncelemede", slug: "incelemede", status: "in_review" },
    ]);

    expect(await pendingAdminWork(actorOf(admin), now)).toEqual({
      openReports: 2,
      overdueReports: 1,
      applicationsAwaitingAdmin: 1,
      articlesAwaitingAdmin: 1,
    });
  });

  it("is closed to everyone but an admin", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "active" });

    try {
      await pendingAdminWork(actorOf(editor));
      throw new Error("expected the call to be refused");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("forbidden");
    }
  });
});
