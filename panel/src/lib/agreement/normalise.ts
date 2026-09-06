/**
 * Text normalisation for contract hashes (§5).
 *
 * Both hashes go through this one function, so a document that looks identical
 * on two machines hashes identically: a Windows checkout with CRLF endings and
 * a Linux one with LF must not produce different evidence.
 *
 * Deliberately free of `server-only` — the same normalisation is used when the
 * browser echoes back the hash of the text it displayed.
 */
import { createHash } from "node:crypto";

/**
 * UTF-8, line endings collapsed to `\n`, trailing whitespace on each line
 * removed, and no leading or trailing blank lines.
 */
export function normaliseForHash(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

/** SHA-256 of the normalised text, lower case hex. */
export function hashDocument(text: string): string {
  return createHash("sha256").update(normaliseForHash(text), "utf8").digest("hex");
}
