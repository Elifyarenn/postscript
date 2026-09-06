"use client";

/**
 * Sign or decline. Signing needs an explicit tick; declining needs a reason,
 * which the service also enforces.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import type { ActionState, ServerAction } from "@/components/form";

function Submit({
  label,
  variant,
  disabled,
}: {
  label: string;
  variant: "primary" | "danger";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={disabled || pending}>
      {pending ? "Gönderiliyor…" : label}
    </Button>
  );
}

export function GrantDecision({
  signAction,
  declineAction,
  csrfToken,
  grantId,
  formTextHash,
}: {
  signAction: ServerAction;
  declineAction: ServerAction;
  csrfToken: string;
  grantId: string;
  formTextHash: string;
}) {
  const [signState, submitSign] = useActionState<ActionState, FormData>(signAction, null);
  const [declineState, submitDecline] = useActionState<ActionState, FormData>(declineAction, null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  return (
    <div className="space-y-6">
      {signState?.error && <Alert tone="danger">{signState.error}</Alert>}
      {signState?.success && <Alert tone="success">{signState.success}</Alert>}
      {declineState?.error && <Alert tone="danger">{declineState.error}</Alert>}
      {declineState?.success && <Alert tone="success">{declineState.success}</Alert>}

      <form action={submitSign} className="space-y-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="grantId" value={grantId} />
        {/* Echoed back so the server can prove the text has not changed */}
        <input type="hidden" name="formTextHash" value={formTextHash} />

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="acknowledged"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line"
          />
          <span>
            Yukarıdaki formun tamamını okudum. Sayılan mali hakları belirtilen kapsamda, bedelsiz
            olarak devrediyorum / lisanslıyorum.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="İmzala" variant="primary" disabled={!acknowledged} />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowDecline((value) => !value)}
          >
            {showDecline ? "Reddetmekten vazgeç" : "Reddet"}
          </Button>
        </div>
      </form>

      {showDecline && (
        <form action={submitDecline} className="space-y-4 border-t border-line pt-5">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="grantId" value={grantId} />

          <Field
            label="Ret gerekçesi"
            htmlFor="reason"
            hint="Gerekçe editöre iletilir ve yazı revizyon durumuna döner."
            error={declineState?.fieldErrors?.reason?.[0]}
          >
            <Textarea id="reason" name="reason" required minLength={5} maxLength={1000} />
          </Field>

          <Submit label="Formu reddet" variant="danger" />
        </form>
      )}
    </div>
  );
}
