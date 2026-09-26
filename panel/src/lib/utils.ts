import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes so a later class always wins over an earlier one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * The magazine's clock. Dates were once formatted in "the user's own time
 * zone", but most are formatted on the server, which runs in UTC: every time
 * on the site was three hours early (D-257). Turkey has kept UTC+3 all year
 * since 2016.
 */
export const TURKEY_TIME_ZONE = "Europe/Istanbul";

/** Dates are shown in Turkish, in Turkey's time, wherever they are formatted. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: TURKEY_TIME_ZONE }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TURKEY_TIME_ZONE,
  }).format(date);
}

/**
 * A `datetime-local` value ("2026-10-01T17:00") read as Turkey's time (D-257).
 * `new Date(raw)` would read it in the server's zone, UTC, and an article
 * meant for 17.00 would wait until 20.00. Null when it is not such a value.
 */
export function parseTurkeyLocalDateTime(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) return null;
  const date = new Date(`${raw}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
