/**
 * Password hashing (argon2id) and the password policy.
 *
 * Policy (see D-026 for the departure from §5.1's ten character minimum):
 *  - at least 8 characters, upper and lower case, and a digit
 *  - not in the embedded list of the 10.000 most common passwords
 *  - optional Have I Been Pwned k-anonymity check, off unless PASSWORD_HIBP_CHECK=true
 */
import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { firstUnmetRule, MIN_PASSWORD_LENGTH } from "./password-rules";

export { MIN_PASSWORD_LENGTH };

/** OWASP recommended argon2id profile (DECISIONS.md D-004). */
const ARGON2_OPTIONS = {
  // 2 is Argon2id. The library exports it as an ambient const enum, which
  // cannot be read under isolatedModules, so the value is written out.
  algorithm: 2,
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

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

/** Synchronous part of the policy. Callers may additionally run `isPwned`. */
export function checkPasswordPolicy(plaintext: string): PasswordCheck {
  // The same rules the form ticks off while the visitor types
  const unmet = firstUnmetRule(plaintext);
  if (unmet) {
    return { ok: false, reason: `Şifre kuralı sağlanmadı: ${unmet.label.toLocaleLowerCase("tr")}.` };
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
