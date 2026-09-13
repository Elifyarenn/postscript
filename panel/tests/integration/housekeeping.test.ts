/**
 * The daily housekeeping run (D-103): the retention periods in the KVKK notice
 * are carried out, and one failing task does not stop the others.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import {
  DAILY_TASKS,
  processDueDeletions,
  pruneEndedSessions,
  purgeUnverifiedAccounts,
  runDailyHousekeeping,
} from "@/services/housekeeping";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser, reloadUser } from "../helpers/factories";

const DAY = 86_400_000;
let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
});

let tokenCounter = 0;

async function insertSession(userId: string, lastSeenAt: Date, expiresAt: Date): Promise<string> {
  tokenCounter += 1;
  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: `housekeeping-token-${tokenCounter}`,
      ip: "203.0.113.10",
      userAgent: "vitest",
      lastSeenAt,
      expiresAt,
    })
    .returning({ id: sessions.id });
  return row!.id;
}

async function remainingSessionIds(): Promise<string[]> {
  const rows = await db.select({ id: sessions.id }).from(sessions);
  return rows.map((row) => row.id);
}

describe("pruneEndedSessions", () => {
  it("deletes sessions last used more than a year ago and keeps the rest", async () => {
    const now = new Date();
    const user = await createUser();
    const expired = await insertSession(user.id, new Date(now.getTime() - 366 * DAY), new Date(now.getTime() - 336 * DAY));
    const withinYear = await insertSession(user.id, new Date(now.getTime() - 364 * DAY), new Date(now.getTime() - 334 * DAY));
    const active = await insertSession(user.id, new Date(now.getTime() - 60_000), new Date(now.getTime() + 29 * DAY));

    expect(await pruneEndedSessions(now)).toBe(1);

    const remaining = await remainingSessionIds();
    expect(remaining).not.toContain(expired);
    expect(remaining).toEqual(expect.arrayContaining([withinYear, active]));
  });

  it("never deletes a session that has not expired, however old its last use", async () => {
    const now = new Date();
    const user = await createUser();
    const stillValid = await insertSession(user.id, new Date(now.getTime() - 400 * DAY), new Date(now.getTime() + DAY));

    expect(await pruneEndedSessions(now)).toBe(0);
    expect(await remainingSessionIds()).toContain(stillValid);
  });
});

describe("processDueDeletions", () => {
  it("anonymises only accounts whose request is older than 30 days", async () => {
    const now = new Date();
    const due = await createUser();
    const waiting = await createUser();
    await db.update(users).set({ deletionRequestedAt: new Date(now.getTime() - 31 * DAY) }).where(eq(users.id, due.id));
    await db.update(users).set({ deletionRequestedAt: new Date(now.getTime() - 29 * DAY) }).where(eq(users.id, waiting.id));

    expect(await processDueDeletions(now)).toBe(1);
    expect((await reloadUser(due.id)).deletedAt).not.toBeNull();
    expect((await reloadUser(waiting.id)).deletedAt).toBeNull();
  });
});

describe("purgeUnverifiedAccounts", () => {
  it("removes unverified accounts after 7 days and leaves verified ones alone", async () => {
    const now = new Date();
    const stale = await createUser({ emailVerified: false });
    const fresh = await createUser({ emailVerified: false });
    const verified = await createUser();
    await db.update(users).set({ createdAt: new Date(now.getTime() - 8 * DAY) }).where(eq(users.id, stale.id));
    await db.update(users).set({ createdAt: new Date(now.getTime() - 6 * DAY) }).where(eq(users.id, fresh.id));
    await db.update(users).set({ createdAt: new Date(now.getTime() - 30 * DAY) }).where(eq(users.id, verified.id));

    const result = await purgeUnverifiedAccounts(now);

    expect(result.accounts).toBe(1);
    expect((await reloadUser(stale.id)).deletedAt).not.toBeNull();
    expect((await reloadUser(fresh.id)).deletedAt).toBeNull();
    expect((await reloadUser(verified.id)).deletedAt).toBeNull();
  });
});

describe("runDailyHousekeeping", () => {
  it("includes every retention job the KVKK notice promises", () => {
    const names = DAILY_TASKS.map((task) => task.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "publish_scheduled",
        "process_deletions",
        "purge_unverified",
        "prune_traffic",
        "prune_auth_attempts",
        "prune_sessions",
      ]),
    );
  });

  it("keeps going after a task fails and keeps query parameters out of the error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: string[] = [];

    const outcomes = await runDailyHousekeeping(new Date(), [
      {
        name: "first",
        run: async () => {
          calls.push("first");
          throw new Error("Failed query: delete from sessions\nparams: secret-token-hash");
        },
      },
      {
        name: "second",
        run: async () => {
          calls.push("second");
          return 3;
        },
      },
    ]);

    expect(calls).toEqual(["first", "second"]);
    expect(outcomes).toEqual([
      { name: "first", ok: false, error: "Failed query: delete from sessions" },
      { name: "second", ok: true, result: 3 },
    ]);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("secret-token-hash");
    consoleError.mockRestore();
  });

  it("keeps the database's reason from the cause so a failure can be diagnosed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const [outcome] = await runDailyHousekeeping(new Date(), [
      {
        name: "missing_table",
        run: async () => {
          throw new Error('Failed query: delete from "posts"\nparams: 2025-09-13', {
            cause: new Error('relation "posts" does not exist'),
          });
        },
      },
    ]);

    expect(outcome).toEqual({
      name: "missing_table",
      ok: false,
      error: 'Failed query: delete from "posts" (relation "posts" does not exist)',
    });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("params");
    consoleError.mockRestore();
  });

  it("runs the real task list on a live database without a failure", async () => {
    const outcomes = await runDailyHousekeeping(new Date());
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([]);
    expect(outcomes).toHaveLength(DAILY_TASKS.length);
  });
});
