/**
 * Community handles (D-089).
 *
 * Pure so the rule can be unit tested and shown to the member word for word.
 * A handle is public inside the community, so it must never be mistaken for
 * the magazine itself or for a staff account.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** A handle can be changed once in this many days; picking the first one is free (D-166). */
export const USERNAME_CHANGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the member may change the handle again, or null when they may now.
 * `lastChangedAt` is the last time an existing handle was replaced.
 */
export function nextUsernameChangeAt(lastChangedAt: Date | null, now = new Date()): Date | null {
  if (!lastChangedAt) return null;
  const next = new Date(lastChangedAt.getTime() + USERNAME_CHANGE_DAYS * DAY_MS);
  return next > now ? next : null;
}

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


/* ------------------------------------------------------------------ */
/* Searching members by handle (D-186)                                 */
/* ------------------------------------------------------------------ */

/** Two characters narrow a young community enough; one would list nearly everyone. */
export const USERNAME_SEARCH_MIN = 2;

/**
 * What is left of a typed search once it can only match a handle: lowercased,
 * without "@", and without anything a handle cannot contain.
 */
export function usernameSearchTerm(raw: string): string {
  return normalizeUsername(raw).replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX);
}

/** A LIKE pattern for the term; "_" is a wildcard there, so it is escaped. */
export function usernameSearchPattern(term: string): string {
  return `%${term.replaceAll("_", "\\_")}%`;
}

/** The exact handle first, then those starting with the term, then the rest; A to Z within each. */
export function rankUsernameMatches<T extends { username: string }>(rows: readonly T[], term: string): T[] {
  const rank = (username: string) => (username === term ? 0 : username.startsWith(term) ? 1 : 2);
  return [...rows].sort(
    (a, b) => rank(a.username) - rank(b.username) || a.username.localeCompare(b.username, "tr"),
  );
}
