/**
 * Turns an article's audit rows into the steps an admin reads (D-106).
 *
 * Pure, like the state machine: the service fetches the rows and this decides
 * what each one means in words, so the wording is testable without a database.
 * Statuses stay as raw enum values; the page owns the Turkish status labels.
 */

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
  at: Date;
  actor: string;
  label: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
};

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
