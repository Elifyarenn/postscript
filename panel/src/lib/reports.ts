/**
 * Content report rules that need no database (D-090).
 *
 * 5651 m. 9 gives a hosting provider twenty-four hours to answer a removal
 * request. The in-site report is the fastest such request a member can make,
 * so the moderation queue measures every open report against that clock.
 */
import type { ReportCategory, ReportTarget } from "@/db/schema";

export const REPORT_RESPONSE_HOURS = 24;

export const REPORT_CATEGORIES = [
  "harassment",
  "hate",
  "personal_data",
  "copyright",
  "spam",
  "illegal",
  "impersonation",
  "other",
] as const satisfies readonly ReportCategory[];

/** Worded after the community rules in the terms, so a reporter recognises them. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  harassment: "Hakaret, tehdit veya taciz",
  hate: "Nefret söylemi veya ayrımcılık",
  personal_data: "Kişisel bilgilerin izinsiz paylaşımı",
  copyright: "Bir eserin izinsiz kullanımı",
  spam: "Reklam veya spam",
  illegal: "Suç teşkil eden içerik",
  impersonation: "Başkası adına davranma",
  other: "Diğer",
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  post: "Gönderi",
  comment: "Yorum",
  direct_message: "Özel mesaj",
  anon_message: "Anonim mesaj",
  member: "Hesap",
};

export function reportDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + REPORT_RESPONSE_HOURS * 3_600_000);
}

/** An open report past its twenty-four hours. */
export function isReportOverdue(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() > reportDeadline(createdAt).getTime();
}

/** An open report this old gets a second mail to the admins, once (D-367). */
export const REPORT_REMINDER_HOURS = 18;
/** With less than this left, the queue shows the report as urgent. */
export const REPORT_URGENT_HOURS = 6;

export type ReportClock = { state: "ok" | "urgent" | "overdue"; label: string };

/**
 * How the queue shows a report's 24 hours (D-367): time left, or how long
 * ago it ran out. Before this only an overdue report was marked, so the admin
 * learned of the limit once it had passed.
 */
export function reportClock(createdAt: Date, now: Date = new Date()): ReportClock {
  const left = reportDeadline(createdAt).getTime() - now.getTime();
  const span = Math.abs(left);
  const hours = Math.floor(span / 3_600_000);
  const minutes = Math.floor((span % 3_600_000) / 60_000);
  const text = hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
  // The same edge as `isReportOverdue`: the deadline's own instant is not yet late
  if (left < 0) return { state: "overdue", label: `Süre ${text} önce doldu` };
  return { state: left <= REPORT_URGENT_HOURS * 3_600_000 ? "urgent" : "ok", label: `${text} kaldı` };
}
