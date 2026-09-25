/**
 * Database backed rate limiting (DECISIONS.md D-007).
 *
 * One row per (scope, identifier). A row holds a rolling window counter and an
 * optional lockout. There is no Redis in the stack, and a single counter table
 * is correct as long as the application runs against one database.
 */
import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { authAttempts } from "@/db/schema";

export type AuthScope =
  | "register_ip"
  | "login_ip"
  | "login_account"
  | "login_2fa"
  | "password_reset_ip"
  | "contact_form_ip";

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
  // The contact form mails the magazine; three messages an hour from one address is plenty (D-145)
  contact_form_ip: { limit: 3, windowMs: 60 * 60_000, lockMs: 60 * 60_000 },
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
 * A timestamp for a raw `sql` fragment. drizzle swaps postgres.js's timestamptz
 * serializer for a pass-through, so a bare `Date` reaches the wire unconverted
 * and the query throws in production while PGlite accepts it — that is what
 * broke D-074 (D-250). An ISO string with an explicit cast works on both.
 */
function timestamp(value: Date) {
  return sql`${value.toISOString()}::timestamptz`;
}

/**
 * Counts one attempt against the bucket and reports whether it may proceed.
 * Call this before doing the expensive work (password hashing, sending mail).
 *
 * One statement, not a read followed by a write (D-250). Reading the row and
 * deciding in JavaScript let parallel requests read the same count and write
 * the same `count + 1`, so a burst of guesses cost a single attempt; two first
 * attempts racing to insert a new bucket crashed on the unique index instead.
 * The upsert takes the row lock, and on a conflict Postgres evaluates the CASE
 * expressions against the latest committed row, so every attempt is counted.
 */
export async function consumeAttempt(
  scope: AuthScope,
  identifier: string,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const rule = ruleFor(scope);
  const key = identifier.toLowerCase().trim() || "unknown";

  const at = timestamp(now);
  // A window that started before this instant has rolled over
  const windowCutoff = timestamp(new Date(now.getTime() - rule.windowMs));
  const lockUntil = timestamp(new Date(now.getTime() + rule.lockMs));

  // These read the stored row; `excluded` would be the values being inserted
  const locked = sql`${authAttempts.lockedUntil} is not null and ${authAttempts.lockedUntil} > ${at}`;
  const rolled = sql`${authAttempts.windowStartedAt} < ${windowCutoff}`;

  const rows = await db
    .insert(authAttempts)
    .values({ scope, identifier: key, count: 1, windowStartedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [authAttempts.scope, authAttempts.identifier],
      set: {
        // Still locked out: leave the bucket exactly as it is, refusing must not extend it
        count: sql`case
          when ${locked} then ${authAttempts.count}
          when ${rolled} then 1
          else ${authAttempts.count} + 1
        end`,
        windowStartedAt: sql`case
          when ${locked} then ${authAttempts.windowStartedAt}
          when ${rolled} then ${at}
          else ${authAttempts.windowStartedAt}
        end`,
        lockedUntil: sql`case
          when ${locked} then ${authAttempts.lockedUntil}
          when ${rolled} then null
          when ${authAttempts.count} + 1 > ${rule.limit} then ${lockUntil}
          else null
        end`,
        updatedAt: now,
      },
    })
    .returning({ count: authAttempts.count, lockedUntil: authAttempts.lockedUntil });

  const row = rows[0]!;

  if (row.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: row.lockedUntil.getTime() - now.getTime(),
    };
  }
  return { allowed: true, remaining: Math.max(0, rule.limit - row.count), retryAfterMs: 0 };
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
