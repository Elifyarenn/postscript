/**
 * Database backed rate limiting (DECISIONS.md D-007).
 *
 * One row per (scope, identifier). A row holds a rolling window counter and an
 * optional lockout. There is no Redis in the stack, and a single counter table
 * is correct as long as the application runs against one database.
 */
import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { authAttempts } from "@/db/schema";

export type AuthScope = "register_ip" | "login_ip" | "login_account" | "login_2fa" | "password_reset_ip";

export type RateLimitRule = {
  /** How many attempts are allowed inside one window. */
  limit: number;
  /** Length of the rolling window in milliseconds. */
  windowMs: number;
  /** How long the bucket stays locked once the limit is passed. */
  lockMs: number;
};

/** The limits named in specification §5.1 and §5.2. */
export const RULES: Record<AuthScope, RateLimitRule> = {
  register_ip: { limit: 5, windowMs: 10 * 60_000, lockMs: 10 * 60_000 },
  login_ip: { limit: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  login_account: { limit: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  // The second factor is six digits: five tries a window before a lockout
  login_2fa: { limit: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
  password_reset_ip: { limit: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 },
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the caller may try again; 0 when allowed. */
  retryAfterMs: number;
};

/**
 * Increasing delay between failed logins (§5.2). Capped so an attacker cannot
 * pin a request handler open, and applied before the response is written.
 */
export function failureDelayMs(failureCount: number): number {
  if (failureCount <= 1) return 0;
  return Math.min(2 ** (failureCount - 1) * 100, 2000);
}

function ruleFor(scope: AuthScope): RateLimitRule {
  return RULES[scope];
}

/**
 * Counts one attempt against the bucket and reports whether it may proceed.
 * Call this before doing the expensive work (password hashing, sending mail).
 */
export async function consumeAttempt(
  scope: AuthScope,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const rule = ruleFor(scope);
  const key = identifier.toLowerCase().trim() || "unknown";

  const existing = await db
    .select()
    .from(authAttempts)
    .where(and(eq(authAttempts.scope, scope), eq(authAttempts.identifier, key)))
    .limit(1);

  const row = existing[0];

  if (!row) {
    await db.insert(authAttempts).values({
      scope,
      identifier: key,
      count: 1,
      windowStartedAt: now,
    });
    return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
  }

  // Still locked out: do not extend the lock, just refuse
  if (row.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: row.lockedUntil.getTime() - now.getTime(),
    };
  }

  // The window has rolled over, so the counter starts again
  const windowExpired = now.getTime() - row.windowStartedAt.getTime() > rule.windowMs;
  const nextCount = windowExpired ? 1 : row.count + 1;
  const overLimit = nextCount > rule.limit;

  await db
    .update(authAttempts)
    .set({
      count: nextCount,
      windowStartedAt: windowExpired ? now : row.windowStartedAt,
      lockedUntil: overLimit ? new Date(now.getTime() + rule.lockMs) : null,
      updatedAt: now,
    })
    .where(eq(authAttempts.id, row.id));

  if (overLimit) {
    return { allowed: false, remaining: 0, retryAfterMs: rule.lockMs };
  }
  return { allowed: true, remaining: rule.limit - nextCount, retryAfterMs: 0 };
}

/** How many attempts the bucket currently holds, without counting a new one. */
export async function currentAttemptCount(scope: AuthScope, identifier: string): Promise<number> {
  const key = identifier.toLowerCase().trim() || "unknown";
  const rows = await db
    .select({ count: authAttempts.count })
    .from(authAttempts)
    .where(and(eq(authAttempts.scope, scope), eq(authAttempts.identifier, key)))
    .limit(1);
  return rows[0]?.count ?? 0;
}

/** Called after a successful login so a legitimate user is not punished later. */
export async function clearAttempts(scope: AuthScope, identifier: string): Promise<void> {
  const key = identifier.toLowerCase().trim() || "unknown";
  await db
    .delete(authAttempts)
    .where(and(eq(authAttempts.scope, scope), eq(authAttempts.identifier, key)));
}

/** Housekeeping for the cron job: drops rows whose window is long gone. */
export async function pruneAttempts(olderThan: Date): Promise<void> {
  await db.delete(authAttempts).where(lt(authAttempts.windowStartedAt, olderThan));
}
