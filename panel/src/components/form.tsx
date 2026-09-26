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
 *
 * Forms that return an error keep what was typed (see `useActionForm`).
 */
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { isFailedResult, isSecretField } from "@/lib/form-fields";
import { cn } from "@/lib/utils";
import { Alert, Button } from "./ui";
import type { FormEvent, FormHTMLAttributes, ReactNode } from "react";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
  /** One-time values an action needs to show once, such as recovery codes. */
  codes?: string[];
} | null;

export type ServerAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * The pending flag of the enclosing `ActionForm`. `useFormStatus` does follow
 * a transition started from `onSubmit`, but only through a React detail
 * (a prevented submit with a transition in the same event); the context says
 * the same thing explicitly, so the buttons do not hinge on that detail.
 */
const FormPendingContext = createContext(false);

/**
 * Whether the form around the caller is being submitted. Works both inside an
 * `ActionForm` and inside a plain `<form action>` (through `useFormStatus`),
 * so every submit button can use it.
 */
export function useSubmitPending(): boolean {
  const { pending } = useFormStatus();
  return useContext(FormPendingContext) || pending;
}

/** Empties the secret fields; see `isSecretField` for which and why. */
function clearSecretFields(form: HTMLFormElement) {
  // The prototype setter bypasses React's value tracker, so the input event
  // below reaches a controlled field's onChange (the password checklist) too
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement) || element.value === "") continue;
    if (!isSecretField(element)) continue;
    setValue?.call(element, "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export type ActionFormHandle = {
  state: ActionState;
  pending: boolean;
  dispatch: (formData: FormData) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
};

/**
 * `useActionState` for a form that keeps its fields when the action fails.
 *
 * React 19 resets every uncontrolled field once a form *action* settles,
 * whatever it returned, so a wrong password used to wipe the e-mail and a
 * refused contact message lost its whole text. Here the submit goes through
 * `onSubmit` instead: the default is prevented, the FormData is built from the
 * form and handed to the action inside a transition, and React never marks the
 * form for reset. The outcome then decides: a failure keeps every field but
 * the secrets, a success resets the form just as React did before, so forms
 * that expect to empty after a post (comments, messages) behave as they did.
 *
 * `dispatch` stays on the form's `action` prop too. Before hydration, or with
 * JavaScript off, the browser posts the form natively and the server action
 * still runs (progressive enhancement); once hydrated, `submit` takes over.
 */
export function useActionForm(action: ServerAction): ActionFormHandle {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, null);
  // The form that was submitted, taken from the submit event rather than a
  // ref prop so the handle stays a plain value that render code may read
  const formRef = useRef<HTMLFormElement | null>(null);
  // Set by a submit and cleared once its outcome has been applied, so a second
  // click in the same tick, before `pending` has rendered, cannot post twice
  const awaiting = useRef(false);

  // A layout effect runs in the commit that shows the result, the same point
  // at which React used to reset the form, so defaultValues refreshed by the
  // action's revalidation are already in place when a success resets to them
  useLayoutEffect(() => {
    if (pending || !awaiting.current) return;
    awaiting.current = false;
    const form = formRef.current;
    // A form unmounted meanwhile (a status panel closed mid-save) has nothing left to fix
    if (!form?.isConnected) return;
    if (isFailedResult(state)) clearSecretFields(form);
    else form.reset();
  }, [pending, state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    // A handler before this one (a confirm dialog, a size check) called it off
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (awaiting.current) return;
    awaiting.current = true;
    formRef.current = event.currentTarget;
    // The submitter is passed so a named submit button's value is posted, as
    // React's own form action does
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    // Started synchronously in the submit event: that keeps `useFormStatus`
    // and `isPending` in step, and an async action needs a transition anyway
    startTransition(() => dispatch(formData));
  };

  return { state, pending, dispatch, submit };
}

/**
 * The `<form>` for a `useActionForm` handle: wires the action and the submit
 * handler, and tells the submit buttons inside when it is pending.
 */
export function ActionForm({
  form,
  onSubmit,
  children,
  ...props
}: { form: ActionFormHandle } & Omit<FormHTMLAttributes<HTMLFormElement>, "action">) {
  return (
    <form
      {...props}
      action={form.dispatch}
      onSubmit={(event) => {
        onSubmit?.(event);
        form.submit(event);
      }}
    >
      <FormPendingContext value={form.pending}>{children}</FormPendingContext>
    </form>
  );
}

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
  const pending = useSubmitPending();
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
  const form = useActionForm(action);
  const { state } = form;
  const [valid, setValid] = useState(!requireValid);

  return (
    <ActionForm
      form={form}
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
    </ActionForm>
  );
}

/**
 * A one-button form, for actions with nothing to fill in. It keeps React's
 * own form action: with only hidden fields, the reset after it has nothing to
 * wipe.
 */
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
 * Its button follows either an `ActionForm` or a plain `<form action>`.
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
