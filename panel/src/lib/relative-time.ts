/**
 * Short, human times for the community screens (D-113): "5 dakika önce",
 * "dün", then the date. The designs show "2m ago" beside every post and
 * notification.
 *
 * The zone is fixed to Istanbul: the server runs in UTC, and a message sent at
 * 23:30 must not be dated the next day for a reader in Turkey.
 */

const ZONE = "Europe/Istanbul";

const RELATIVE = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
const DAY = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONE,
});
const CLOCK = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  // A clock a little ahead of ours still reads as "just now", never "in 3 seconds"
  if (seconds < 60) return "az önce";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return RELATIVE.format(-minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE.format(-days, "day");

  return DAY.format(date);
}

/** "14 Eylül 2026": the day chip between messages. */
export function formatDayLabel(date: Date): string {
  return DAY.format(date);
}

/** "18:42": the time under a message bubble. */
export function formatClockTime(date: Date): string {
  return CLOCK.format(date);
}
