/**
 * D-333: a test writer keeps their account but is not on the writer roster.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Database } from "@/db/client";
import { listUsers } from "@/services/users";
import { listTemporaryAreaCandidates } from "@/services/issue-area-grants";
import { TEST_WRITER_EMAILS, isTestWriterEmail } from "@/lib/test-accounts";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
});

describe("a test writer (D-333)", () => {
  it("is left out of the writers list and the temporary-area picker, but stays an account", async () => {
    const admin = await createUser({ role: "admin" });
    const real = await createUser({ role: "writer", writerStatus: "active", displayName: "Gerçek Yazar" });
    const tester = await createUser({
      role: "writer",
      writerStatus: "active",
      displayName: "Test Yazarı",
      email: TEST_WRITER_EMAILS[0],
    });

    const writers = await listUsers(actorOf(admin), { segment: "writers" });
    expect(writers.map((row) => row.id)).toEqual([real.id]);
    const everyone = await listUsers(actorOf(admin), { segment: "all" });
    expect(everyone.map((row) => row.id)).toContain(tester.id);

    const candidates = await listTemporaryAreaCandidates(actorOf(admin));
    expect(candidates.map((row) => row.id)).toEqual([real.id]);
  });

  it("matches the address whatever its case", () => {
    expect(isTestWriterEmail(" SemraIlhan@Outlook.com ")).toBe(true);
    expect(isTestWriterEmail("someone@example.com")).toBe(false);
  });
});
