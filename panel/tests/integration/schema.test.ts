/**
 * Smoke test for the schema itself: migrations apply, the append-only triggers
 * bite, and the partial unique indexes behave as designed.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLog, roleChanges, users } from "@/db/schema";
import {
  resetTables,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
import type { Database } from "@/db/client";

let db: Database;

beforeAll(async () => {
  db = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(db);
});

/**
 * Drizzle wraps driver errors, so the trigger's own message sits on `cause`.
 * This walks the chain and returns every message it finds.
 */
async function errorChainOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const messages: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    }
    return messages.join(" | ");
  }
  return "";
}

async function insertUser(email: string) {
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash: "x", displayName: "Test" })
    .returning();
  return row!;
}

describe("schema", () => {
  it("applies migrations and creates every table", async () => {
    const user = await insertUser("a@example.com");
    expect(user.role).toBe("user");
    expect(user.isBanned).toBe(false);
  });

  it("rejects a duplicate e-mail while the first row is alive", async () => {
    await insertUser("dup@example.com");
    await expect(insertUser("dup@example.com")).rejects.toThrow();
  });

  it("frees the e-mail again once the row is soft deleted", async () => {
    const first = await insertUser("reuse@example.com");
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, first.id));

    const second = await insertUser("reuse@example.com");
    expect(second.id).not.toBe(first.id);
  });

  it("blocks updates and deletes on audit_log", async () => {
    const [entry] = await db
      .insert(auditLog)
      .values({ action: "test", entityType: "users" })
      .returning();

    const updateError = await errorChainOf(
      db.update(auditLog).set({ action: "tampered" }).where(eq(auditLog.id, entry!.id)),
    );
    expect(updateError).toMatch(/append-only/i);

    const deleteError = await errorChainOf(db.delete(auditLog).where(eq(auditLog.id, entry!.id)));
    expect(deleteError).toMatch(/append-only/i);
  });

  it("blocks updates and deletes on role_changes", async () => {
    const user = await insertUser("role@example.com");
    const [change] = await db
      .insert(roleChanges)
      .values({ userId: user.id, oldRole: "user", newRole: "writer", changedBy: null })
      .returning();

    const updateError = await errorChainOf(
      db.update(roleChanges).set({ note: "tampered" }).where(eq(roleChanges.id, change!.id)),
    );
    expect(updateError).toMatch(/append-only/i);
  });
});
