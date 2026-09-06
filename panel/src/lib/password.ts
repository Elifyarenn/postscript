/**
 * Password hashing (argon2id) and the password policy.
 *
 * Policy, per specification §5.1:
 *  - at least 10 characters
 *  - not in the embedded list of the 10.000 most common passwords
 *  - optional Have I Been Pwned k-anonymity check, off unless PASSWORD_HIBP_CHECK=true
 */
import "server-only";
import { hash, verify, Algorithm } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/** OWASP recommended argon2id profile (DECISIONS.md D-004). */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(digest: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(digest, plaintext, ARGON2_OPTIONS);
  } catch {
    // A malformed hash in the database must read as "wrong password", not crash
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Common password list                                                */
/* ------------------------------------------------------------------ */

let commonPasswords: Set<string> | null = null;

function loadCommonPasswords(): Set<string> {
  if (commonPasswords) return commonPasswords;

  try {
    const file = path.join(process.cwd(), "data", "common-passwords.txt");
    const contents = readFileSync(file, "utf8");
    commonPasswords = new Set(
      contents
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    // Never let a missing data file turn into "every password is fine"
    commonPasswords = new Set(["password", "123456", "12345678", "qwerty", "111111"]);
  }
  return commonPasswords;
}

export const MIN_PASSWORD_LENGTH = 10;

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

/** Synchronous part of the policy. Callers may additionally run `isPwned`. */
export function checkPasswordPolicy(plaintext: string): PasswordCheck {
  if (plaintext.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` };
  }
  if (plaintext.length > 256) {
    return { ok: false, reason: "Şifre en fazla 256 karakter olabilir." };
  }
  if (loadCommonPasswords().has(plaintext.toLowerCase())) {
    return { ok: false, reason: "Bu şifre çok yaygın kullanılıyor, başka bir şifre seçin." };
  }
  return { ok: true };
}

/**
 * Have I Been Pwned range API using k-anonymity: only the first five characters
 * of the sha1 digest leave the server, never the password itself.
 * Any network failure is treated as "not found" so login never hard-fails on it.
 */
export async function isPwned(plaintext: string): Promise<boolean> {
  if (process.env.PASSWORD_HIBP_CHECK !== "true") return false;

  const digest = createHash("sha1").update(plaintext, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body
      .split(/\r?\n/)
      .some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);
  } catch {
    return false;
  }
}
