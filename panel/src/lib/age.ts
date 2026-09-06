/**
 * Age calculation (DECISIONS.md D-013).
 *
 * The 18 year rule for writers is enforced in code, so the result must not
 * depend on the server's time zone. Everything below works on UTC calendar
 * days. A 29 February birthday counts as completed on 1 March in common years.
 */
import "server-only";

export const MINIMUM_WRITER_AGE = 18;

/** Parses `YYYY-MM-DD` into its numeric parts, or null when malformed. */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Round-trip through Date to reject impossible days such as 2025-02-30
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (
    asDate.getUTCFullYear() !== year ||
    asDate.getUTCMonth() !== month - 1 ||
    asDate.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Completed years between `birthDate` (YYYY-MM-DD) and `at`.
 * Returns null when the date cannot be parsed or lies in the future.
 */
export function calculateAge(birthDate: string, at: Date = new Date()): number | null {
  const birth = parseIsoDate(birthDate);
  if (!birth) return null;

  const todayYear = at.getUTCFullYear();
  const todayMonth = at.getUTCMonth() + 1;
  const todayDay = at.getUTCDate();

  let age = todayYear - birth.year;

  // Birthday has not come round yet this year, so one year is not complete
  const hadBirthday =
    todayMonth > birth.month || (todayMonth === birth.month && todayDay >= birth.day);
  if (!hadBirthday) age -= 1;

  if (age < 0) return null;
  return age;
}

/** The rule the promotion flow checks: writers must be at least 18. */
export function isAdult(birthDate: string, at: Date = new Date()): boolean {
  const age = calculateAge(birthDate, at);
  return age !== null && age >= MINIMUM_WRITER_AGE;
}
