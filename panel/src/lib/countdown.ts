/**
 * The time left until an issue comes out (D-192), as a pure function so the
 * arithmetic can be tested without a clock.
 */

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The moment has come (or passed). */
  done: boolean;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const left = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / HOUR),
    minutes: Math.floor((left % HOUR) / MINUTE),
    seconds: Math.floor((left % MINUTE) / SECOND),
    done: left === 0,
  };
}

/** "1 Ekim 17.00", in Turkey's time whatever the reader's device says. */
export function formatReleaseMoment(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" }).format(date);
  const time = new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  })
    .format(date)
    .replace(":", ".");
  return `${day} ${time}`;
}
