/**
 * TOTP two factor authentication (DECISIONS.md D-006).
 *
 * Mandatory for editors and admins, optional for writers. The secret is stored
 * encrypted; recovery codes are stored as argon2id hashes and are single use.
 */
import "server-only";
import * as OTPAuth from "otpauth";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { totpRecoveryCodes, users } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { env } from "@/lib/env";

const ISSUER = "postscript";
const RECOVERY_CODE_COUNT = 10;

function totpFor(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/** A fresh base32 secret, not yet stored anywhere. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** The `otpauth://` URI that authenticator apps scan as a QR code. */
export function buildOtpAuthUrl(secretBase32: string, accountLabel: string): string {
  return totpFor(secretBase32, accountLabel).toString();
}

/**
 * Checks a six digit code. A window of one step either side absorbs clock
 * drift without meaningfully widening the guessing window.
 */
export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;

  const delta = totpFor(secretBase32, ISSUER).validate({ token: cleaned, window: 1 });
  return delta !== null;
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

/** Stores the secret in encrypted form but leaves 2FA unconfirmed until a code is proven. */
export async function stageTotpSecret(userId: string, secretBase32: string): Promise<void> {
  await db
    .update(users)
    .set({
      totpSecret: encryptSecret(secretBase32, env().SESSION_SECRET),
      totpConfirmedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function readTotpSecret(userId: string): Promise<string | null> {
  const rows = await db
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const stored = rows[0]?.totpSecret;
  if (!stored) return null;
  return decryptSecret(stored, env().SESSION_SECRET);
}

export async function confirmTotp(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ totpConfirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function disableTotp(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ totpSecret: null, totpConfirmedAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await db.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, userId));
}

/* ------------------------------------------------------------------ */
/* Recovery codes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Replaces any existing recovery codes and returns the plaintext ones. This is
 * the only moment they can be read; only hashes are kept.
 */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  await db.delete(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, userId));

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-"),
  );

  const hashed = await Promise.all(codes.map((code) => hashPassword(code)));
  await db.insert(totpRecoveryCodes).values(
    hashed.map((codeHash) => ({ userId, codeHash })),
  );

  return codes;
}

/** Consumes a recovery code. Returns false when it is unknown or already used. */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalised = code.trim().toUpperCase();
  const candidates = await db
    .select()
    .from(totpRecoveryCodes)
    .where(and(eq(totpRecoveryCodes.userId, userId), isNull(totpRecoveryCodes.usedAt)));

  for (const candidate of candidates) {
    if (await verifyPassword(candidate.codeHash, normalised)) {
      await db
        .update(totpRecoveryCodes)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(eq(totpRecoveryCodes.id, candidate.id));
      return true;
    }
  }
  return false;
}
