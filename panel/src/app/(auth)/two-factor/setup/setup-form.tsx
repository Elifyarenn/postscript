"use client";

/**
 * The confirm step of TOTP enrolment.
 *
 * It lives in a client component because the recovery codes come back in the
 * action's result and are shown exactly once; only hashes are kept server side.
 *
 * Once they are on screen the session is already trusted, so the last step is
 * simply a way onwards. It is gated on the reader confirming they kept the
 * codes, because there is no second chance to read them.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
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
  continueHref,
}: {
  action: ServerAction;
  csrfToken: string;
  /** Where this account belongs once the second factor is in place. */
  continueHref: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  // Enrolment is done: show the codes and the way onwards, not the form again
  if (state?.codes) {
    return (
      <div className="space-y-4">
        {state.success && <Alert tone="success">{state.success}</Alert>}

        <RecoveryCodes codes={state.codes} />

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line"
          />
          <span>Kurtarma kodlarını güvenli bir yere kaydettim.</span>
        </label>

        <Button type="button" disabled={!saved} onClick={() => router.push(continueHref)}>
          Panele devam et
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}

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
    </form>
  );
}
