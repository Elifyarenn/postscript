/**
 * The banned word filter (module 4).
 *
 * Pure text processing: the caller supplies the banned list, this module
 * masks every occurrence in the text. Matching is a case-insensitive
 * substring search on Turkish-lowercased text, so suffixed forms are caught
 * too; the first letter of each hit stays readable, the rest becomes stars.
 * The admin curates the list precisely because substring matching can hit
 * innocent words.
 */

/** Lowercase in the Turkish locale, which is what user content is matched against. */
export function normalizeBannedWord(raw: string): string {
  return raw.trim().toLocaleLowerCase("tr");
}

/**
 * Replaces every occurrence of every banned word with `k***` style stars.
 * Positions come from the lowercased copy; lengths match for Turkish, so the
 * same indices apply to the original string.
 */
export function maskBannedWords(text: string, banned: string[]): string {
  const lower = text.toLocaleLowerCase("tr");
  let masked = text;

  for (const word of banned) {
    const needle = normalizeBannedWord(word);
    if (needle === "") continue;

    let from = 0;
    for (;;) {
      const index = lower.indexOf(needle, from);
      if (index === -1) break;

      // Keep the letter that was actually there, star the rest
      const stars = "*".repeat(Math.max(needle.length - 1, 0));
      masked = masked.slice(0, index) + masked.charAt(index) + stars + masked.slice(index + needle.length);

      // Do not re-match inside what we just masked
      from = index + needle.length;
    }
  }

  return masked;
}