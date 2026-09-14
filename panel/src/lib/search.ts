/**
 * A LIKE pattern that finds `text` anywhere (D-112).
 *
 * The reader types the search, so `%`, `_` and the escape character itself
 * are taken literally: "100%" must not match every title starting with "100".
 * Backslash is PostgreSQL's default LIKE escape, on Neon and on PGlite alike.
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
