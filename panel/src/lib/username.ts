/**
 * Community handles (D-089).
 *
 * Pure so the rule can be unit tested and shown to the member word for word.
 * A handle is public inside the community, so it must never be mistaken for
 * the magazine itself or for a staff account.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/** Handles that would let someone pass as the magazine or its staff. */
const RESERVED = new Set([
  "admin",
  "administrator",
  "anonim",
  "anonymous",
  "destek",
  "editor",
  "iletisim",
  "kvkk",
  "moderator",
  "postscript",
  "postscriptmag",
  "root",
  "sistem",
  "support",
  "system",
  "yonetici",
  "yonetim",
  "yazar",
]);

/** Lowercases and trims, and drops a leading "@" people naturally type. */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");
}

/** Null when the handle is acceptable, otherwise the reason in Turkish. */
export function usernameProblem(normalized: string): string | null {
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    return `Kullanıcı adı ${USERNAME_MIN}-${USERNAME_MAX} karakter olmalı.`;
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return "Kullanıcı adı yalnızca küçük harf (a-z), rakam ve alt çizgi içerebilir.";
  }
  // "postscript_official" is as misleading as "postscript"
  for (const reserved of RESERVED) {
    if (normalized === reserved || normalized.startsWith(`${reserved}_`)) {
      return "Bu kullanıcı adı kullanılamaz.";
    }
  }
  return null;
}
