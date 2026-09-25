/**
 * The rate limiter against a real PostgreSQL server through postgres.js, the
 * production driver (D-078, D-250).
 *
 * PGlite has one connection and its own parameter handling, so it can neither
 * produce true concurrency nor catch driver-specific SQL failures — D-074
 * passed every PGlite test and then broke login in production. This file runs
 * only when RATE_LIMIT_TEST_DATABASE_URL points at an EMPTY throwaway database
 * (a Neon branch, never production); it applies the migrations there itself.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { authAttempts } from "@/db/schema";
import { closeDatabase, setDatabase, type Database } from "@/db/client";
import { clearAttempts, consumeAttempt, currentAttemptCount, RULES } from "@/lib/rate-limit";

const url = process.env.RATE_LIMIT_TEST_DATABASE_URL;

describe.skipIf(!url)("rate limiter on real PostgreSQL (postgres.js)", () => {
  let database: Database;

  beforeAll(async () => {
    // A real pool, so parallel calls really do run on separate connections
    const client = postgres(url!, { max: 20, onnotice: () => {} });
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    setDatabase(database, async () => {
      await client.end({ timeout: 5 });
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await database.delete(authAttempts);
  });

  async function storedRow(scope: keyof typeof RULES, identifier: string) {
    const [row] = await database
      .select()
      .from(authAttempts)
      .where(and(eq(authAttempts.scope, scope), eq(authAttempts.identifier, identifier)));
    return row;
  }

  it("rejects a bare Date inside a sql template — the D-074 failure", async () => {
    await expect(database.execute(sql`select ${new Date()} as at`)).rejects.toThrow();
  });

  it("1. sequential: allows exactly the limit, then refuses", async () => {
    const rule = RULES.login_ip;
    for (let attempt = 1; attempt <= rule.limit; attempt += 1) {
      const result = await consumeAttempt("login_ip", "198.51.100.1");
      expect(result).toMatchObject({ allowed: true, remaining: rule.limit - attempt });
    }
    const refused = await consumeAttempt("login_ip", "198.51.100.1");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(rule.lockMs);
  });

  it("2. parallel: a burst on a new bucket lets through exactly the limit", async () => {
    const rule = RULES.login_ip;
    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () => consumeAttempt("login_ip", "198.51.100.2")),
    );

    expect(results.filter((result) => result.status === "rejected")).toHaveLength(0);
    const allowed = results.filter(
      (result) => result.status === "fulfilled" && result.value.allowed,
    );
    expect(allowed).toHaveLength(rule.limit);

    const row = await storedRow("login_ip", "198.51.100.2");
    // Attempts up to the locking one are counted, refusals leave the row as it is
    expect(row?.count).toBe(rule.limit + 1);
    expect(row?.lockedUntil).not.toBeNull();
  });

  it("2b. parallel: repeated bursts on an existing bucket never overshoot", async () => {
    const rule = RULES.login_2fa;
    await consumeAttempt("login_2fa", "burst-user");
    let allowed = 1;
    for (let round = 0; round < 3; round += 1) {
      const results = await Promise.all(
        Array.from({ length: 15 }, () => consumeAttempt("login_2fa", "burst-user")),
      );
      allowed += results.filter((result) => result.allowed).length;
    }
    expect(allowed).toBe(rule.limit);
    expect(await currentAttemptCount("login_2fa", "burst-user")).toBe(rule.limit + 1);
  });

  it("3. boundary: with one attempt left, two parallel requests get one slot", async () => {
    const rule = RULES.password_reset_ip;
    for (let attempt = 0; attempt < rule.limit - 1; attempt += 1) {
      await consumeAttempt("password_reset_ip", "198.51.100.3");
    }
    const results = await Promise.all([
      consumeAttempt("password_reset_ip", "198.51.100.3"),
      consumeAttempt("password_reset_ip", "198.51.100.3"),
    ]);
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(results.find((result) => result.allowed)?.remaining).toBe(0);
    expect(await currentAttemptCount("password_reset_ip", "198.51.100.3")).toBe(rule.limit + 1);
  });

  it("4. window expiry: a locked bucket opens again once window and lock have passed", async () => {
    const rule = RULES.contact_form_ip;
    const start = new Date();
    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeAttempt("contact_form_ip", "198.51.100.4", start);
    }
    expect((await consumeAttempt("contact_form_ip", "198.51.100.4", start)).allowed).toBe(false);

    const later = new Date(start.getTime() + Math.max(rule.windowMs, rule.lockMs) + 1_000);
    const reopened = await consumeAttempt("contact_form_ip", "198.51.100.4", later);
    expect(reopened).toMatchObject({ allowed: true, remaining: rule.limit - 1 });

    const row = await storedRow("contact_form_ip", "198.51.100.4");
    expect(row?.count).toBe(1);
    expect(row?.lockedUntil).toBeNull();
    expect(row?.windowStartedAt.getTime()).toBe(later.getTime());
  });

  it("5. different IPs: parallel bursts from several addresses stay independent", async () => {
    const rule = RULES.register_ip;
    const ips = ["198.51.100.10", "198.51.100.11", "198.51.100.12", "198.51.100.13"];
    const results = await Promise.all(
      ips.flatMap((ip) =>
        Array.from({ length: 12 }, () =>
          consumeAttempt("register_ip", ip).then((result) => ({ ip, result })),
        ),
      ),
    );
    for (const ip of ips) {
      const allowed = results.filter((entry) => entry.ip === ip && entry.result.allowed);
      expect(allowed).toHaveLength(rule.limit);
      expect(await currentAttemptCount("register_ip", ip)).toBe(rule.limit + 1);
    }
  });

  it("6. different identifiers and scopes do not share a bucket", async () => {
    const rule = RULES.login_account;
    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeAttempt("login_account", "first@example.com");
    }
    expect((await consumeAttempt("login_account", "first@example.com")).allowed).toBe(false);
    expect((await consumeAttempt("login_account", "second@example.com")).allowed).toBe(true);
    // Same identifier string under another scope is its own bucket
    expect((await consumeAttempt("login_ip", "first@example.com")).allowed).toBe(true);
    // Casing and padding still land in one bucket
    await consumeAttempt("login_account", "  SECOND@example.com ");
    expect(await currentAttemptCount("login_account", "second@example.com")).toBe(2);
  });

  it("7. success: clearing the bucket after a successful login starts it afresh", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await consumeAttempt("login_account", "success@example.com");
    }
    await clearAttempts("login_account", "success@example.com");
    expect(await storedRow("login_account", "success@example.com")).toBeUndefined();

    const next = await consumeAttempt("login_account", "success@example.com");
    expect(next).toMatchObject({ allowed: true, remaining: RULES.login_account.limit - 1 });
  });

  it("8. failure: refusals while locked neither count nor extend the lock", async () => {
    const rule = RULES.login_2fa;
    for (let attempt = 0; attempt <= rule.limit; attempt += 1) {
      await consumeAttempt("login_2fa", "locked-user");
    }
    const before = await storedRow("login_2fa", "locked-user");

    const refusals = await Promise.all(
      Array.from({ length: 10 }, () => consumeAttempt("login_2fa", "locked-user")),
    );
    expect(refusals.every((result) => !result.allowed)).toBe(true);

    const after = await storedRow("login_2fa", "locked-user");
    expect(after?.count).toBe(before?.count);
    expect(after?.lockedUntil?.getTime()).toBe(before?.lockedUntil?.getTime());
  });
});
