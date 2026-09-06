/**
 * Low level cryptographic helpers.
 *
 * Nothing here knows about the database or HTTP; it is pure so it can be unit
 * tested directly.
 */
import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Hex encoded sha256 of a UTF-8 string. Used for document hashes and token lookup keys. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** A URL-safe random token. 32 bytes = 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * The value stored for a session or e-mail token. The raw token never touches
 * the database, and the pepper means a database dump alone cannot be replayed.
 */
export function hashToken(rawToken: string, pepper: string): string {
  return sha256Hex(`${rawToken}.${pepper}`);
}

/** Length-safe comparison for secrets that were derived from user input. */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/* ------------------------------------------------------------------ */
/* Symmetric encryption for the TOTP secret (DECISIONS.md D-006)       */
/* ------------------------------------------------------------------ */

const ENCRYPTION_INFO = "postscript.totp.v1";

function deriveKey(secret: string): Buffer {
  // HKDF gives a clean 32 byte key from a secret of arbitrary length
  return Buffer.from(hkdfSync("sha256", secret, "postscript.salt", ENCRYPTION_INFO, 32));
}

/** Returns `v1.<iv>.<authTag>.<ciphertext>`, all base64url. */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string, secret: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported encrypted payload format");
  }
  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string];

  const key = deriveKey(secret);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
