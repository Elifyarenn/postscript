"use client";

/**
 * Client side form helpers.
 *
 * `PanelForm` wires a server action to `useActionState` so every form in the
 * panel reports errors the same way and disables its submit button while the
 * action is in flight.
 *
 * Fields are rendered on the server and passed in as ordinary children, so
 * validation messages are collected at the top of the form rather than shown
 * beside each input: a server component cannot subscribe to client state.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import { Alert, Button } from "./ui";
import type { ReactNode } from "react";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
  /** One-time values an action needs to show once, such as recovery codes. */
  codes?: string[];
} | null;

export type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Turkish labels for the field names the schemas use. */
const FIELD_LABELS: Record<string, string> = {
  email: "E-posta",
  password: "Şifre",
  passwordConfirm: "Şifre tekrarı",
  currentPassword: "Mevcut şifre",
  displayName: "Ad Soyad",
  penName: "Mahlas",
  birthDate: "Doğum tarihi",
  bio: "Biyografi",
  title: "Başlık",
  bodyMarkdown: "Metin",
  summary: "Özet",
  number: "Numara",
  reason: "Gerekçe",
  code: "Kod",
  file: "Dosya",
  licenseType: "Lisans türü",
  kvkkConsent: "KVKK onayı",
  acknowledged: "Onay kutusu",
  username: "Kullanıcı adı",
  body: "Metin",
  category: "Bildirim türü",
  decision: "Karar",
  note: "Not",
  name: "Ad",
  message: "Mesaj",
  topic: "Konu",
  subject: "Konu",
  newEmail: "Yeni e-posta",
  token: "Bağlantı",
};

function FieldErrors({ fieldErrors }: { fieldErrors: Record<string, string[]> }) {
  // `requirements` is the promotion checklist and gets its own box
  const entries = Object.entries(fieldErrors).filter(([key]) => key !== "requirements");
  if (entries.length === 0) return null;

  return (
    <Alert tone="danger" title="Formda düzeltilmesi gereken alanlar var">
      <ul className="mt-1 list-disc pl-5">
        {entries.map(([field, messages]) => (
          <li key={field}>
            <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
            {messages.join(" ")}
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function SubmitButton({
  children,
  variant = "primary",
  disabled,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending || disabled}
      className={className}
      aria-label={ariaLabel}
    >
      {pending ? "Gönderiliyor…" : children}
    </Button>
  );
}

export function PanelForm({
  action,
  csrfToken,
  submitLabel,
  submitVariant = "primary",
  requireValid = false,
  submitClassName,
  submitContent,
  children,
}: {
  action: ServerAction;
  csrfToken: string;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "danger";
  /** Restyles the submit button, as the magazine frame's forms do (D-113). */
  submitClassName?: string;
  /**
   * What the submit button shows instead of the label, such as an icon (D-116).
   * The label stays the button's accessible name.
   */
  submitContent?: ReactNode;
  /**
   * Keeps the submit button shut until every field satisfies its own
   * constraints. Used where a rule is shown live, so the button matches what
   * the checklist says rather than contradicting it.
   */
  requireValid?: boolean;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [valid, setValid] = useState(!requireValid);

  return (
    <form
      action={formAction}
      className="space-y-4"
      noValidate={false}
      onInput={
        requireValid
          ? (event) => setValid(event.currentTarget.checkValidity())
          : undefined
      }
    >
      {/* Double submit token; the action compares it with the cookie */}
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {/* The promotion check returns its missing prerequisites this way */}
      {state?.fieldErrors?.requirements && (
        <Alert tone="warning" title="Eksik ön koşullar">
          <ul className="mt-1 list-disc pl-5">
            {state.fieldErrors.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </Alert>
      )}

      {state?.fieldErrors && <FieldErrors fieldErrors={state.fieldErrors} />}

      {children}

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton
          variant={submitVariant}
          disabled={requireValid && !valid}
          className={submitClassName}
          ariaLabel={submitContent ? submitLabel : undefined}
        >
          {submitContent ?? submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** A one-button form, for actions with nothing to fill in. */
export function ActionButton({
  action,
  csrfToken,
  label,
  variant = "secondary",
  fields,
  confirmMessage,
  display,
  className,
}: {
  action: ServerAction;
  csrfToken: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** Extra hidden values the action needs, such as a target id. */
  fields?: Record<string, string>;
  confirmMessage?: string;
  /**
   * What the button shows instead of the label, such as an icon and a count
   * (D-113). The label stays the button's accessible name, so a screen reader
   * still hears "Beğen (3)" rather than "3".
   */
  display?: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);

  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input type="hidden" name="csrfToken" value={csrfToken} />
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        className={cn("px-2.5 py-1 text-xs", className)}
        aria-label={display ? label : undefined}
        title={display ? label : undefined}
      >
        {display ?? label}
      </Button>
      {state?.error && <span className="ml-2 text-xs text-danger">{state.error}</span>}
      {state?.success && <span className="ml-2 text-xs text-accent">{state.success}</span>}
    </form>
  );
}

/**
 * The feedback and the submit button of a form that manages its own action
 * state — a page-layout form, say, where the fields are built by hand (D-234).
 */
export function SubmitRow({
  state,
  label,
  variant = "primary",
}: {
  state: ActionState;
  label: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <div className="space-y-3">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      {state?.fieldErrors && <FieldErrors fieldErrors={state.fieldErrors} />}
      <div className="flex items-center gap-3 pt-1">
        <SubmitButton variant={variant}>{label}</SubmitButton>
      </div>
    </div>
  );
}
