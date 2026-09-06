/**
 * The password rules, in one place.
 *
 * This module is deliberately free of `server-only`: the registration form
 * ticks the rules off as they are met while the visitor types, and the server
 * checks the very same functions before it accepts anything. One definition,
 * two readers — so the ticks can never promise something the server refuses.
 */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordRuleId = "length" | "letterCase" | "digit";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  met: boolean;
};

/** Evaluates every rule against a candidate password. */
export function passwordRules(value: string): PasswordRule[] {
  return [
    {
      id: "length",
      label: `En az ${MIN_PASSWORD_LENGTH} karakter`,
      met: value.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "letterCase",
      label: "Büyük ve küçük harf",
      // Unicode-aware, so "Ş" and "ı" count like "S" and "i"
      met: /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value),
    },
    {
      id: "digit",
      label: "En az bir rakam",
      met: /\d/.test(value),
    },
  ];
}

export function meetsPasswordRules(value: string): boolean {
  return passwordRules(value).every((rule) => rule.met);
}

/** The first unmet rule, used for the server's error message. */
export function firstUnmetRule(value: string): PasswordRule | null {
  return passwordRules(value).find((rule) => !rule.met) ?? null;
}
