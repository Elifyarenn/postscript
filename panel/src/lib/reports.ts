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
