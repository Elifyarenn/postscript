/**
 * Turns an article's audit rows into the steps people read (D-106, D-107).
 *
 * Pure, like the state machine: the service fetches the rows and this decides
 * what each one means in words and what the author may see, so both are
 * testable without a database. Statuses stay as raw enum values; the card owns
 * the Turkish status labels.
 */
import type { ArticleStatus } from "@/db/schema";

export type AuditRow = {
  id: string;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
  actorName: string | null;
};

export type HistoryStep = {
  id: string;
  action: string;
  at: Date;
  actor: string;
  label: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
};

/** Who is reading: editorial staff see everything, the author sees their inbox's view. */
export type HistoryAudience = "staff" | "author";

/**
 * The status changes the author is told about by e-mail, the reviewer's note
 * included. The author's history shows notes only for these, so the screen
 * never reveals more than the inbox already has.
 */
export const AUTHOR_TOLD_STATUSES: readonly ArticleStatus[] = [
  "revision_requested",
  "published",
  "withdrawn",
];

const PLAGIARISM_LABELS: Record<string, string> = {
  not_run: "kontrol edilmedi",
  clean: "temiz",
  flagged: "işaretlendi",
};

const BYLINE_LABELS: Record<string, string> = {
  real_name: "gerçek ad",
  pen_name: "mahlas",
};

/** A non-empty string field of a JSON payload, or null. */
function field(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function describeStep(row: AuditRow): HistoryStep {
  const base: HistoryStep = {
    id: row.id,
    action: row.action,
    at: row.createdAt,
    // A scheduled job writes no actor, and a deleted account's id is nulled out
    actor: row.actorName ?? "Sistem",
    label: row.action,
    fromStatus: null,
    toStatus: null,
    note: null,
  };

  switch (row.action) {
    case "article.created":
      return { ...base, label: "Makale kaydı açıldı" };
    case "article.created_by_author":
      return { ...base, label: "Yazar taslağı oluşturdu" };
    case "article.updated":
      return { ...base, label: "Makale düzenlendi" };
    case "article.updated_by_author":
      return { ...base, label: "Yazar taslağı düzenledi" };
    case "article.status_changed":
      return {
        ...base,
        label: "Durum değişti",
        fromStatus: field(row.before, "status"),
        toStatus: field(row.after, "status"),
        note: field(row.after, "note"),
      };
    case "article.comment_added":
      return { ...base, label: "Editöryal not eklendi" };
    case "article.plagiarism_status_set": {
      const status = field(row.after, "status");
      const label = status ? (PLAGIARISM_LABELS[status] ?? status) : "—";
      return { ...base, label: `İntihal kontrolü: ${label}`, note: field(row.after, "note") };
    }
    case "work_approval.opened":
      return { ...base, label: "Eser Onayı yazara açıldı" };
    case "work_approval.signed": {
      const byline = field(row.after, "bylineChoice");
      return {
        ...base,
        label: byline
          ? `Yazar Eser Onayını imzaladı (yayın adı: ${BYLINE_LABELS[byline] ?? byline})`
          : "Yazar Eser Onayını imzaladı",
      };
    }
    case "work_approval.declined":
      return { ...base, label: "Yazar Eser Onayını reddetti", note: field(row.after, "reason") };
    case "work_approval.revoked":
      return { ...base, label: "Eser Onayı iptal edildi (içerik değişikliği)" };
    default:
      // A new action still shows up, under its raw name, rather than vanishing
      return base;
  }
}

/** Narrows the history to what the given audience may see (D-107). */
export function stepsForAudience(steps: HistoryStep[], audience: HistoryAudience): HistoryStep[] {
  if (audience === "staff") return steps;

  const told = AUTHOR_TOLD_STATUSES as readonly string[];
  return (
    steps
      // The plagiarism check is an internal assessment the author is never shown
      .filter((step) => step.action !== "article.plagiarism_status_set")
      // Reviewers' notes from the internal stages were never sent to the author
      .map((step) =>
        step.action === "article.status_changed" && !told.includes(step.toStatus ?? "")
          ? { ...step, note: null }
          : step,
      )
  );
}
