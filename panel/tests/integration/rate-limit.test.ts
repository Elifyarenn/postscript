/**
 * The database-backed rate limiter (D-007, D-074).
 *
 * The counter is one upsert rather than a read followed by a write, so these
 * cover the thing a sequential test would miss: parallel attempts must each
 * cost one, not share one.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { authAttempts } from "@/db/schema";
import {
  clearAttempts,
  consumeAttempt,
  currentAttemptCount,
  failureDelayMs,
  pruneAttempts,
  RULES,
} from "@/lib/rate-limit";
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

describe("consumeAttempt", () => {
  it("allows exactly the limit and locks the one after", async () => {
    const rule = RULES.login_ip;

    for (let attempt = 1; attempt <= rule.limit; attempt += 1) {
      const result = await consumeAttempt("login_ip", "203.0.113.1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(rule.limit - attempt);
    }

    const locked = await consumeAttempt("login_ip", "203.0.113.1");
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterMs).toBeGreaterThan(0);
    expect(locked.retryAfterMs).toBeLessThanOrEqual(rule.lockMs);
  });

  it("refuses while locked without extending the lock", async () => {
    const rule = RULES.login_2fa;
    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeAttempt("login_2fa", "someone");
    }

    const first = await consumeAttempt("login_2fa", "someone");
    const second = await consumeAttempt("login_2fa", "someone");

    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
    // The second refusal must not push the deadline further out
    expect(second.retryAfterMs).toBeLessThanOrEqual(first.retryAfterMs);
  });

  /**
   * D-074: the old SELECT-then-UPDATE let parallel requests read the same
   * count and write the same `count + 1`, so a burst cost one attempt.
   */
  it("charges every parallel attempt, not just one", async () => {
    const parallel = 8;

    await Promise.all(
      Array.from({ length: parallel }, () => consumeAttempt("login_account", "race@example.com")),
    );

    expect(await currentAttemptCount("login_account", "race@example.com")).toBe(parallel);
  });

  it("starts a fresh window once the old one has rolled over", async () => {
    const rule = RULES.password_reset_ip;

    // Fill the bucket to the limit, then age the window past its length
    for (let attempt = 0; attempt < rule.limit; attempt += 1) {
      await consumeAttempt("password_reset_ip", "203.0.113.2");
    }
    await db
      .update(authAttempts)
      .set({ windowStartedAt: new Date(Date.now() - rule.windowMs - 60_000) })
      .where(
        and(
          eq(authAttempts.scope, "password_reset_ip"),
          eq(authAttempts.identifier, "203.0.113.2"),
        ),
      );

    const afterRollover = await consumeAttempt("password_reset_ip", "203.0.113.2");
    expect(afterRollover.allowed).toBe(true);
    expect(afterRollover.remaining).toBe(rule.limit - 1);
  });

  it("normalises the identifier, so casing and padding share one bucket", async () => {
    await consumeAttempt("login_account", "  Reader@Example.COM ");
    await consumeAttempt("login_account", "reader@example.com");

    expect(await currentAttemptCount("login_account", "reader@example.com")).toBe(2);
  });
});

describe("housekeeping", () => {
  it("clears a bucket after a successful login", async () => {
    await consumeAttempt("login_ip", "203.0.113.3");
    await clearAttempts("login_ip", "203.0.113.3");

    expect(await currentAttemptCount("login_ip", "203.0.113.3")).toBe(0);
  });

  it("prunes rows whose window is long gone", async () => {
    await consumeAttempt("login_ip", "203.0.113.4");
    await db
      .update(authAttempts)
      .set({ windowStartedAt: new Date(Date.now() - 86_400_000) })
      .where(eq(authAttempts.identifier, "203.0.113.4"));

    await pruneAttempts(new Date(Date.now() - 3_600_000));

    expect(await db.select().from(authAttempts)).toHaveLength(0);
  });
});

describe("failureDelayMs", () => {
  it("grows with each failure and stops at two seconds", () => {
    expect(failureDelayMs(0)).toBe(0);
    expect(failureDelayMs(1)).toBe(0);
    expect(failureDelayMs(2)).toBe(200);
    expect(failureDelayMs(3)).toBe(400);
    expect(failureDelayMs(50)).toBe(2000);
  });
});
