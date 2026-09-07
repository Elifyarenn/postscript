/**
 * The small component set the panel is built from.
 *
 * Written by hand in the shadcn/ui style (Tailwind classes plus `cn`) rather
 * than generated, so there is no runtime dependency and every element stays
 * readable. The panel is a working tool, so these are plain and functional.
 */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 border-accent",
  secondary: "bg-surface text-ink hover:bg-paper border-line",
  danger: "bg-danger text-white hover:bg-danger/90 border-danger",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-paper border-transparent",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-ink", className)} {...props} />;
}

const FIELD_CLASSES =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent " +
  "disabled:bg-paper disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD_CLASSES, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_CLASSES, "min-h-28 font-mono", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(FIELD_CLASSES, className)} {...props} />;
}

/** Label, control and an optional error message, in the panel's standard spacing. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-lg border border-line bg-surface p-5 shadow-sm", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_TONES: Record<AlertTone, string> = {
  info: "border-line bg-surface text-ink",
  success: "border-accent/30 bg-accent-soft text-accent",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", ALERT_TONES[tone])} role="alert">
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={cn(title && "mt-1")}>{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status badges                                                       */
/* ------------------------------------------------------------------ */

/** Turkish labels for the enum values, so raw database words never reach the UI. */
export const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  in_review: "İncelemede",
  revision_requested: "Revizyon istendi",
  accepted: "Kabul edildi",
  awaiting_rights: "Devir formu bekleniyor",
  scheduled: "Yayına planlandı",
  published: "Yayınlandı",
  archived: "Arşivlendi",
  withdrawn: "Geri çekildi",
  planning: "Planlanıyor",
  in_production: "Üretimde",
  pending: "Bekliyor",
  signed: "İmzalandı",
  declined: "Reddedildi",
  revoked: "İptal edildi",
  pending_agreement: "Sözleşme bekliyor",
  active: "Aktif",
  suspended: "Askıda",
  user: "Kullanıcı",
  writer: "Yazar",
  editor: "Editör",
  admin: "Yönetici",
  not_run: "Kontrol edilmedi",
  clean: "Temiz",
  flagged: "İşaretlendi",
  submitted: "Başvuru alındı",
  editor_approved: "Editör onayı geçti",
  admin_approved: "Sözleşme hazır",
  editor_rejected: "Editör reddetti",
  admin_rejected: "Yönetim reddetti",
  info: "Bilgilendirme",
  important: "Önemli",
  critical: "Kritik",
};

const BADGE_TONES: Record<string, string> = {
  published: "bg-accent-soft text-accent border-accent/30",
  signed: "bg-accent-soft text-accent border-accent/30",
  active: "bg-accent-soft text-accent border-accent/30",
  clean: "bg-accent-soft text-accent border-accent/30",
  withdrawn: "bg-danger-soft text-danger border-danger/30",
  declined: "bg-danger-soft text-danger border-danger/30",
  revoked: "bg-danger-soft text-danger border-danger/30",
  flagged: "bg-danger-soft text-danger border-danger/30",
  suspended: "bg-danger-soft text-danger border-danger/30",
  revision_requested: "bg-warning-soft text-warning border-warning/30",
  awaiting_rights: "bg-warning-soft text-warning border-warning/30",
  pending: "bg-warning-soft text-warning border-warning/30",
  pending_agreement: "bg-warning-soft text-warning border-warning/30",
  editor_approved: "bg-warning-soft text-warning border-warning/30",
  admin_approved: "bg-warning-soft text-warning border-warning/30",
  submitted: "bg-warning-soft text-warning border-warning/30",
  editor_rejected: "bg-danger-soft text-danger border-danger/30",
  admin_rejected: "bg-danger-soft text-danger border-danger/30",
  important: "bg-warning-soft text-warning border-warning/30",
  critical: "bg-danger-soft text-danger border-danger/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[status] ?? "border-line bg-paper text-muted",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-4 py-2.5 align-middle", className)} {...props} />;
}
