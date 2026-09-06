/**
 * Test data builders. Everything a test does not care about gets a sane
 * default, so each test only states the thing it is actually about.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type Role, type User, type WriterStatus } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import type { Actor } from "@/lib/auth/rbac";

let counter = 0;

export const TEST_PASSWORD = "Test-Password-2026";

export type UserOverrides = {
  email?: string;
  role?: Role;
  writerStatus?: WriterStatus | null;
  emailVerified?: boolean;
  identityVerified?: boolean;
  kvkkConsent?: boolean;
  birthDate?: string | null;
  isBanned?: boolean;
  password?: string;
  displayName?: string;
};

/** An adult, verified, consented account: the shape that passes every §6 check. */
export async function createUser(overrides: UserOverrides = {}): Promise<User> {
  counter += 1;
  const now = new Date();

  const [row] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user${counter}@example.com`,
      passwordHash: await hashPassword(overrides.password ?? TEST_PASSWORD),
      displayName: overrides.displayName ?? `Test User ${counter}`,
      role: overrides.role ?? "user",
      writerStatus: overrides.writerStatus ?? null,
      emailVerifiedAt: overrides.emailVerified === false ? null : now,
      identityVerifiedAt: overrides.identityVerified === false ? null : now,
      kvkkConsentAt: overrides.kvkkConsent === false ? null : now,
      kvkkConsentVersion: overrides.kvkkConsent === false ? null : 1,
      birthDate: overrides.birthDate === undefined ? "1995-05-05" : overrides.birthDate,
      isBanned: overrides.isBanned ?? false,
    })
    .returning();

  return row!;
}

/** The subset of a user that the permission functions work with. */
export function actorOf(user: User): Actor {
  return {
    id: user.id,
    role: user.role,
    writerStatus: user.writerStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    isBanned: user.isBanned,
    totpConfirmedAt: user.totpConfirmedAt,
  };
}

export async function reloadUser(userId: string): Promise<User> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]!;
}

export const noMeta = { ip: "203.0.113.10", userAgent: "vitest" };
