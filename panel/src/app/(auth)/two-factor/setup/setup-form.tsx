"use client";

/**
 * The confirm step of TOTP enrolment.
 *
 * It lives in a client component because the recovery codes come back in the
 * action's result and are shown exactly once; only hashes are kept server side.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Field, Input } from "@/components/ui";
import { RecoveryCodes } from "./recovery-codes";
import type { ActionState, ServerAction } from "@/components/form";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Doğrulanıyor…" : "Doğrula ve aç"}
    </Button>
  );
}

export function TotpSetupForm({
  action,
  csrfToken,
}: {
  action: ServerAction;
  csrfToken: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {state?.codes ? (
        <RecoveryCodes codes={state.codes} />
      ) : (
        <>
          <Field label="Uygulamadaki kod" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              className="tracking-[0.3em]"
            />
          </Field>

          <Submit />
        </>
      )}
    </form>
  );
}
