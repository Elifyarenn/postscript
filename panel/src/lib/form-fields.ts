/**
 * What a form keeps after its action returns (see `useActionForm` in
 * `src/components/form.tsx`). Kept free of React and of the DOM so the rules
 * can be unit tested in the node test environment.
 */

/** The fields of an action result that decide whether the submit failed. */
type ResultLike =
  | { error?: string; fieldErrors?: Record<string, string[]>; success?: string; codes?: string[] }
  | null
  | undefined;

/**
 * A result counts as a failure when it carries an error message or field
 * errors. `null`, a `success` message or returned codes count as success, so
 * the form resets exactly as it did while React reset every form action.
 */
export function isFailedResult(state: ResultLike): boolean {
  return Boolean(state?.error) || Boolean(state?.fieldErrors);
}

/** The attributes of an input that mark it as a secret. */
export type FieldLike = {
  type: string;
  /** The `autocomplete` attribute as the DOM reports it, e.g. "one-time-code". */
  autocomplete: string;
  dataset?: { clearOnError?: string };
};

/**
 * Whether a field is emptied after a failed submit instead of being kept.
 *
 * Passwords and one-time codes are cleared on purpose: a wrong password is
 * better retyped than left on screen for a shoulder-surfer or a shared
 * computer, and a TOTP or recovery code is either already spent or about to
 * expire, so keeping it would only invite a second failure. A field that
 * holds such a secret without either marker (the recovery-code input is a
 * plain text box) opts in with `data-clear-on-error`.
 */
export function isSecretField(field: FieldLike): boolean {
  if (field.type.toLowerCase() === "password") return true;
  if (field.autocomplete.toLowerCase().split(/\s+/).includes("one-time-code")) return true;
  return field.dataset?.clearOnError !== undefined;
}
