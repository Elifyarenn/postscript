/**
 * TOTP second factor (DECISIONS.md D-048) and its recovery codes (D-099).
 *
 * The secret is generated on the server and shown to the user once so it can
 * be put into an authenticator app; it is stored (AES-GCM encrypted with the
 * session pepper) only after a valid code proves the app received it. Login is
 * a two step dance: the password half runs first, then a single-use challenge
 * ticket is exchanged for the six digit code — or for one recovery code.
 *
 * Mandatory for editor and admin (CLAUDE.md security rules); the gate lives
 * in requireRole / guardPanel, and every browser session for such a user only
 * exists after the code passed.
 */
import "server-only";
import { randomInt } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { generateSecret, generateURI, verifySync } from "otplib";
import { z } from "zod";
import { db } from "@/db/client";
import { loginChallenges, totpRecoveryCodes, users, type User } from "@/db/schema";
import { decryptSecret, encryptSecret, hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound, rateLimited } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { verifyPassword } from "@/lib/password";
import { consumeAttempt } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/session";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

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
/* Recovery codes (D-099)                                              */
/* ------------------------------------------------------------------ */

export const RECOVERY_CODE_COUNT = 10;

// No 0/o, 1/i/l: the code is copied off paper onto a phone keyboard
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const RECOVERY_CODE_LENGTH = 10;

/** `xxxxx-xxxxx`, about 50 bits; brute force is capped by the login_2fa limit. */
function generateRecoveryCode(): string {
  let raw = "";
  for (let index = 0; index < RECOVERY_CODE_LENGTH; index += 1) {
    raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Capitals, spaces and the dash are how people retype a code, not part of it. */
function normalizeRecoveryCode(typed: string): string {
  return typed.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashRecoveryCode(code: string): string {
  return hashToken(normalizeRecoveryCode(code), env().SESSION_SECRET);
}

/** Spends one unused code. The `used_at is null` condition makes a race lose. */
async function consumeRecoveryCode(userId: string, typed: string): Promise<boolean> {
  if (normalizeRecoveryCode(typed).length !== RECOVERY_CODE_LENGTH) return false;

  const used = await db
    .update(totpRecoveryCodes)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(totpRecoveryCodes.userId, userId),
        eq(totpRecoveryCodes.codeHash, hashRecoveryCode(typed)),
        isNull(totpRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: totpRecoveryCodes.id });

  return used.length > 0;
}

export async function countRecoveryCodesLeft(userId: string): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(totpRecoveryCodes)
    .where(and(eq(totpRecoveryCodes.userId, userId), isNull(totpRecoveryCodes.usedAt)));
  return rows[0]?.total ?? 0;
}

type Factor = "totp" | "recovery_code";

/**
 * The proof D-033 asks for before a factor is reset or a login completes: the
 * current authenticator code, or one recovery code. A six digit input is only
 * ever tried as TOTP, so a mistyped app code cannot burn a recovery code.
 */
async function proveSecondFactor(user: User, code: string): Promise<Factor | null> {
  if (user.totpEnabledAt === null || !user.totpSecret) return null;

  if (/^\d{6}$/.test(code)) {
    const secret = decryptSecret(user.totpSecret, env().SESSION_SECRET);
    return verifyTotpCode(secret, code) ? "totp" : null;
  }

  return (await consumeRecoveryCode(user.id, code)) ? "recovery_code" : null;
}

const factorProofSchema = z.strictObject({
  password: z.string().min(1),
  code: z.string().min(1, "Doğrulama kodunu veya bir kurtarma kodunu girin.").max(32),
});

/**
 * Replaces the user's recovery codes with a fresh set and returns the raw
 * codes, which exist nowhere else. Needs the password and a second factor,
 * like turning 2FA off: a stolen session alone must not mint a way back in.
 */
export async function regenerateRecoveryCodes(
  input: { userId: string; password: string; code: string },
  meta: RequestMeta,
): Promise<string[]> {
  const parsed = factorProofSchema.safeParse({ password: input.password, code: input.code });
  if (!parsed.success) {
    throw badRequest("Kurtarma kodu bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const user = await loadUser(input.userId);
  if (user.totpEnabledAt === null || !user.totpSecret) {
    throw badRequest("Kurtarma kodu oluşturmak için önce iki adımlı doğrulamayı açın.");
  }

  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    throw forbidden("Mevcut şifreniz doğrulanamadı.");
  }

  const factor = await proveSecondFactor(user, parsed.data.code);
  if (!factor) {
    throw badRequest("Kod doğrulanamadı.", { code: ["Uygulamadaki kodu veya bir kurtarma kodunu girin."] });
  }

  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) codes.add(generateRecoveryCode());

  await db.transaction(async (tx) => {
    await tx.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, user.id));
    await tx
      .insert(totpRecoveryCodes)
      .values([...codes].map((code) => ({ userId: user.id, codeHash: hashRecoveryCode(code) })));
  });

  await writeAudit({
    actorId: user.id,
    action: "user.recovery_codes_generated",
    entityType: "users",
    entityId: user.id,
    after: { factor, count: codes.size },
    ip: meta.ip,
  });

  return [...codes];
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

/**
 * Turns 2FA off. The current password and a second factor are both required;
 * a recovery code counts, which is how a lost phone is replaced (D-099).
 */
export async function disableTotp(
  input: { userId: string; password: string; code: string },
  meta: RequestMeta,
): Promise<void> {
  const parsed = factorProofSchema.safeParse({ password: input.password, code: input.code });
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

  const factor = await proveSecondFactor(user, parsed.data.code);
  if (!factor) {
    throw badRequest("Kod doğrulanamadı.", { code: ["Kod doğrulanamadı. Uygulamadaki kodu girin."] });
  }

  // Codes belong to the secret they were issued beside; a new setup gets new ones
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ totpSecret: null, totpEnabledAt: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, user.id));
  });

  await writeAudit({
    actorId: user.id,
    action: "user.totp_disabled",
    entityType: "users",
    entityId: user.id,
    after: { factor },
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

/**
 * True when the code is the user's current TOTP or one of their unused
 * recovery codes. A recovery code is spent here, recorded, and the owner is
 * told by mail: if it was not them, they learn it before the next login.
 */
export async function verifyLoginCode(
  userId: string,
  code: string,
  meta?: RequestMeta,
): Promise<boolean> {
  const user = await loadUser(userId);
  const factor = await proveSecondFactor(user, code);

  if (factor === "recovery_code") {
    const remaining = await countRecoveryCodesLeft(user.id);
    await writeAudit({
      actorId: user.id,
      action: "user.recovery_code_used",
      entityType: "users",
      entityId: user.id,
      after: { purpose: "login", remaining },
      ip: meta?.ip ?? null,
    });
    const message = templates.recoveryCodeUsed({ displayName: user.displayName, remaining });
    await sendMail({ to: user.email, subject: message.subject, text: message.text });
  }

  return factor !== null;
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
