/**
 * TOTP second factor (DECISIONS.md D-048).
 *
 * The secret is generated on the server and shown to the user once so it can
 * be put into an authenticator app; it is stored (AES-GCM encrypted with the
 * session pepper) only after a valid code proves the app received it. Login is
 * a two step dance: the password half runs first, then a single-use challenge
 * ticket is exchanged for the six digit code.
 *
 * Mandatory for editor and admin (CLAUDE.md security rules); the gate lives
 * in requireRole / guardPanel, and every browser session for such a user only
 * exists after the code passed.
 */
import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { generateSecret, generateURI, verifySync } from "otplib";
import { z } from "zod";
import { db } from "@/db/client";
import { loginChallenges, users } from "@/db/schema";
import { decryptSecret, encryptSecret, hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound, rateLimited } from "@/lib/errors";
import { verifyPassword } from "@/lib/password";
import { consumeAttempt } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import type { RequestMeta } from "./auth";

export const TOTP_ISSUER = "Postscript";
/** How long the post-password challenge ticket stays valid. */
export const CHALLENGE_TTL_MS = 5 * 60_000;
/** Cookie that carries the challenge ticket between the two login steps. */
export const TWO_FACTOR_COOKIE = "ps_2fa_challenge";

/** A fresh random base32 secret for the authenticator app. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** The `otpauth://` URI an authenticator app scans. */
export function otpauthUri(secret: string, accountName: string): string {
  return generateURI({ strategy: "totp", issuer: TOTP_ISSUER, label: accountName, secret });
}

/** True when `code` is a current six digit TOTP for `secret`. */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  try {
    // One step of tolerance each way: slow machines and clock drift must not
    // turn a legitimate login into a lockout
    return verifySync({ secret, token: code, epochTolerance: 1 }).valid;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Enabling and disabling                                              */
/* ------------------------------------------------------------------ */

const codeSchema = z.string().regex(/^\d{6}$/, "Altı haneli doğrulama kodunu girin.");

/**
 * Turns 2FA on. Both the current password and a valid code for the secret the
 * user just scanned must be present, and every existing session is revoked so
 * nothing that predates the second factor survives.
 */
export async function enableTotp(
  input: { userId: string; password: string; pendingSecret: string; code: string },
  meta: RequestMeta,
): Promise<void> {
  // `userId` comes from the session, never from the client, so it is parsed
  // out of the strict shape
  const parsed = z
    .strictObject({
      password: z.string().min(1),
      pendingSecret: z.string().min(16, "Oturum kodunu tazeleyip yeniden deneyin."),
      code: codeSchema,
    })
    .safeParse({ password: input.password, pendingSecret: input.pendingSecret, code: input.code });
  if (!parsed.success) {
    throw badRequest("İki adımlı doğrulama ayarları geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const user = await loadUser(input.userId);
  if (user.totpEnabledAt !== null) throw conflict("İki adımlı doğrulama zaten açık.");

  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    throw forbidden("Mevcut şifreniz doğrulanamadı.");
  }

  if (!verifyTotpCode(parsed.data.pendingSecret, parsed.data.code)) {
    throw badRequest("Kod doğrulanamadı.", { code: ["Kod doğrulanamadı. Uygulamadaki kodu girin."] });
  }

  const encrypted = encryptSecret(parsed.data.pendingSecret, env().SESSION_SECRET);
  await db
    .update(users)
    .set({ totpSecret: encrypted, totpEnabledAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Nothing that predates the second factor may keep working
  await revokeAllSessions(user.id);

  await writeAudit({
    actorId: user.id,
    action: "user.totp_enabled",
    entityType: "users",
    entityId: user.id,
    ip: meta.ip,
  });
}

/** Turns 2FA off. The current password and a code are both required. */
export async function disableTotp(
  input: { userId: string; password: string; code: string },
  meta: RequestMeta,
): Promise<void> {
  const parsed = z
    .strictObject({ password: z.string().min(1), code: codeSchema })
    .safeParse({ password: input.password, code: input.code });
  if (!parsed.success) {
    throw badRequest("İki adımlı doğrulama ayarları geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const user = await loadUser(input.userId);
  if (user.totpEnabledAt === null || !user.totpSecret) {
    throw badRequest("İki adımlı doğrulama zaten kapalı.");
  }

  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    throw forbidden("Mevcut şifreniz doğrulanamadı.");
  }

  const secret = decryptSecret(user.totpSecret, env().SESSION_SECRET);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    throw badRequest("Kod doğrulanamadı.", { code: ["Kod doğrulanamadı. Uygulamadaki kodu girin."] });
  }

  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await writeAudit({
    actorId: user.id,
    action: "user.totp_disabled",
    entityType: "users",
    entityId: user.id,
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* The login challenge ticket                                          */
/* ------------------------------------------------------------------ */

/**
 * Issues a single-use ticket for the second half of a two-factor login. The
 * raw token goes to the browser (cookie); only its peppered hash is stored.
 */
export async function createLoginChallenge(userId: string): Promise<string> {
  const rawToken = randomToken(32);
  await db.insert(loginChallenges).values({
    userId,
    tokenHash: hashToken(rawToken, env().SESSION_SECRET),
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });
  return rawToken;
}

/**
 * Reads the ticket without spending it. Returns the user id it was issued to,
 * or null when the ticket is unknown, expired or already spent.
 *
 * Reading and spending are separate on purpose (D-073). They used to be one
 * call made before the code was checked, so a single mistyped digit burned the
 * ticket and sent the user back to the password screen — and the five-try
 * `login_2fa` limit could never be reached, because there was never a second
 * try to count.
 */
export async function readLoginChallenge(rawToken: string): Promise<string | null> {
  const rows = await db
    .select({ userId: loginChallenges.userId })
    .from(loginChallenges)
    .where(
      and(
        eq(loginChallenges.tokenHash, hashToken(rawToken, env().SESSION_SECRET)),
        isNull(loginChallenges.consumedAt),
        gt(loginChallenges.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0]?.userId ?? null;
}

/**
 * Spends the ticket, once the code has actually passed. The `consumed_at is
 * null` condition is part of the UPDATE, so two racing requests cannot both
 * win: only the one that changed a row gets `true`.
 */
export async function consumeLoginChallenge(rawToken: string): Promise<boolean> {
  const consumed = await db
    .update(loginChallenges)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(loginChallenges.tokenHash, hashToken(rawToken, env().SESSION_SECRET)),
        isNull(loginChallenges.consumedAt),
        gt(loginChallenges.expiresAt, new Date()),
      ),
    )
    .returning({ id: loginChallenges.id });

  return consumed.length > 0;
}

/** True when the code matches the user's stored secret. */
export async function verifyLoginCode(userId: string, code: string): Promise<boolean> {
  const user = await loadUser(userId);
  if (user.totpEnabledAt === null || !user.totpSecret) return false;
  const secret = decryptSecret(user.totpSecret, env().SESSION_SECRET);
  return verifyTotpCode(secret, code);
}

/**
 * The brute force guard for the second half of a login. Code guessing is
 * pointless for more than a handful of tries per window (D-007, login_2fa).
 */
export async function checkLoginCodeLimit(userId: string): Promise<void> {
  const limit = await consumeAttempt("login_2fa", userId);
  if (!limit.allowed) {
    throw rateLimited("Çok fazla hatalı kod denemesi yapıldı, 15 dakika bekleyin.");
  }
}

async function loadUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw notFound("Hesap bulunamadı.");
  return user;
}