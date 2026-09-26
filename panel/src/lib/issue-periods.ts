/**
 * An issue's two windows: choosing topics and handing in articles (D-261).
 *
 * Pure, so the pages, the services and the tests all read the same clock
 * rules. Both ends are inclusive: a request at exactly the closing minute is
 * still in time, one a moment later is not. Times are stored as instants
 * (timestamptz) and shown and typed in Turkey's time.
 */
import { TURKEY_TIME_ZONE, parseTurkeyLocalDateTime } from "@/lib/utils";

export type PeriodState = "unset" | "upcoming" | "open" | "closed";

export type Period = { opensAt: Date | null; closesAt: Date | null };

export function periodState(period: Period, now: Date): PeriodState {
  if (!period.opensAt || !period.closesAt) return "unset";
  const time = now.getTime();
  if (time < period.opensAt.getTime()) return "upcoming";
  if (time > period.closesAt.getTime()) return "closed";
  return "open";
}

export type IssuePeriods = {
  topicOpensAt: Date | null;
  topicClosesAt: Date | null;
  submissionOpensAt: Date | null;
  submissionClosesAt: Date | null;
};

export function topicPeriod(issue: IssuePeriods): Period {
  return { opensAt: issue.topicOpensAt, closesAt: issue.topicClosesAt };
}

export function submissionPeriod(issue: IssuePeriods): Period {
  return { opensAt: issue.submissionOpensAt, closesAt: issue.submissionClosesAt };
}

/**
 * An issue made before the windows existed (issue 1, D-261) has none set, and
 * its articles keep the flow they started in: no topic, no delivery window.
 */
export function usesIssueWindows(issue: IssuePeriods): boolean {
  return issue.submissionOpensAt !== null || issue.topicOpensAt !== null;
}

/** Badge keys (`STATUS_LABELS` in components/ui.tsx). */
export function periodBadge(state: PeriodState): string {
  return `period_${state}`;
}

export const TOPIC_PERIOD_TEXT: Record<PeriodState, string> = {
  unset: "Konu belirleme tarihi belirlenmedi",
  upcoming: "Konu belirleme henüz başlamadı",
  open: "Konu belirleme açık",
  closed: "Konu belirleme sona erdi",
};

export const SUBMISSION_PERIOD_TEXT: Record<PeriodState, string> = {
  unset: "Yazı kabul tarihi belirlenmedi",
  upcoming: "Yazı kabulü henüz başlamadı",
  open: "Yazı kabulü açık",
  closed: "Yazı kabulü sona erdi",
};

/** "28 Eylül 18:00", in Turkey's time wherever it is formatted. */
export function formatPeriodMoment(date: Date): string {
  const day = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    timeZone: TURKEY_TIME_ZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TURKEY_TIME_ZONE,
  }).format(date);
  return `${day} ${time}`;
}

/** "28 Eylül 18:00 – 5 Ekim 18:00", or null when the window is not set. */
export function formatPeriod(period: Period): string | null {
  if (!period.opensAt || !period.closesAt) return null;
  return `${formatPeriodMoment(period.opensAt)} – ${formatPeriodMoment(period.closesAt)}`;
}

/** The value a `datetime-local` field needs to show this instant in Turkey's time. */
export function toTurkeyLocalInput(date: Date | null): string {
  if (!date) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TURKEY_TIME_ZONE,
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  // Some engines print midnight as 24
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export type PeriodInput = { opens: string | null; closes: string | null };

/**
 * Reads one window from two form fields. Both empty is "not set"; one alone,
 * an unreadable value or a start not before its end is refused with a
 * sentence the form can show. The same rule the database checks.
 */
export function parsePeriod(
  input: PeriodInput,
  label: string,
): { ok: true; period: Period } | { ok: false; message: string } {
  const opensRaw = input.opens?.trim() || null;
  const closesRaw = input.closes?.trim() || null;
  if (!opensRaw && !closesRaw) return { ok: true, period: { opensAt: null, closesAt: null } };
  if (!opensRaw || !closesRaw) {
    return { ok: false, message: `${label}: başlangıç ve bitişin ikisi de girilmeli.` };
  }
  const opensAt = parseTurkeyLocalDateTime(opensRaw);
  const closesAt = parseTurkeyLocalDateTime(closesRaw);
  if (!opensAt || !closesAt) return { ok: false, message: `${label}: tarih ve saat okunamadı.` };
  if (opensAt.getTime() >= closesAt.getTime()) {
    return { ok: false, message: `${label}: başlangıç, bitişten önce olmalı.` };
  }
  return { ok: true, period: { opensAt, closesAt } };
}
