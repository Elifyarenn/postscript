"use client";

/**
 * Generates a fresh set of recovery codes and shows them once (D-099).
 *
 * `PanelForm` only reports a message, so this form renders the returned codes
 * itself. They live in this component's state alone: a reload loses them, and
 * nothing on the server can show them again.
 */
import { useActionState } from "react";
import { Alert, Button, Field, Input } from "./ui";
import type { ActionState, ServerAction } from "./form";

export function RecoveryCodesForm({
  action,
  csrfToken,
  codesLeft,
}: {
  action: ServerAction;
  csrfToken: string;
  /** Unused codes the account holds right now. */
  codesLeft: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);

  return (
    <div className="space-y-4">
      {state?.codes ? (
        <Alert tone="warning" title="Kurtarma kodlarınız">
          <p>
            Bu kodlar yalnızca şimdi gösteriliyor. Bir kâğıda yazın veya şifre yöneticinize
            kaydedin; telefonunuzdan ayrı bir yerde saklayın. Her kod bir kez kullanılır.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm text-ink">
            {state.codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </Alert>
      ) : codesLeft === 0 ? (
        <Alert tone="warning" title="Kurtarma kodunuz yok">
          Telefonunuzu kaybederseniz hesabınıza giremezsiniz. Şimdi kurtarma kodu oluşturun.
        </Alert>
      ) : (
        <p className="text-sm text-muted">{codesLeft} kullanılmamış kurtarma kodunuz var.</p>
      )}

      <form action={formAction} className="space-y-4">
        {/* Double submit token; the action compares it with the cookie */}
        <input type="hidden" name="csrfToken" value={csrfToken} />
        {state?.error && <Alert tone="danger">{state.error}</Alert>}

        <Field label="Mevcut şifre" htmlFor="recoveryPassword">
          <Input
            id="recoveryPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label="Uygulamadaki kod veya bir kurtarma kodu"
          htmlFor="recoveryProof"
        >
          <Input
            id="recoveryProof"
            name="code"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending
            ? "Gönderiliyor…"
            : codesLeft === 0
              ? "Kurtarma kodları oluştur"
              : "Yeni kurtarma kodları oluştur"}
        </Button>
      </form>
    </div>
  );
}
