"use client";

/**
 * One pending work approval: title, the hash of the accepted text, the contract
 * version it rests on, how the author wants to be credited, and the sentence
 * they tick (§7.2).
 *
 * The hash is carried in a hidden field and re-derived on the server; if the
 * text moved while this screen was open the approval is refused rather than
 * silently applied to something the writer never read.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import type { ActionState, ServerAction } from "@/components/form";

type Approval = {
  id: string;
  articleTitle: string;
  articleHash: string;
  agreementVersion: number | null;
  penName: string | null;
  displayName: string;
};

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

export function ApprovalRow({
  approveAction,
  declineAction,
  csrfToken,
  approval,
  statement,
  locked,
}: {
  approveAction: ServerAction;
  declineAction: ServerAction;
  csrfToken: string;
  approval: Approval;
  statement: string;
  locked: boolean;
}) {
  const [approveState, submitApprove] = useActionState<ActionState, FormData>(approveAction, null);
  const [declineState, submitDecline] = useActionState<ActionState, FormData>(declineAction, null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showDecline, setShowDecline] = useState(false);

  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <h3 className="font-serif text-base">{approval.articleTitle}</h3>

      <dl className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="inline">Kabul edilen metnin özeti (SHA-256): </dt>
          <dd className="inline font-mono break-all">{approval.articleHash}</dd>
        </div>
        <div>
          <dt className="inline">Sözleşme sürümü: </dt>
          <dd className="inline">v{approval.agreementVersion ?? "—"}</dd>
        </div>
      </dl>

      {approveState?.error && (
        <div className="mt-3">
          <Alert tone="danger">{approveState.error}</Alert>
        </div>
      )}
      {declineState?.error && (
        <div className="mt-3">
          <Alert tone="danger">{declineState.error}</Alert>
        </div>
      )}

      <form action={submitApprove} className="mt-4 space-y-3">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="grantId" value={approval.id} />
        {/* Echoed back so the server can prove the text has not changed */}
        <input type="hidden" name="articleHash" value={approval.articleHash} />

        <Field
          label="Yayın adı"
          htmlFor={`byline-${approval.id}`}
          hint="Bu eser için sabitlenir (Sözleşme m. 7.1)."
        >
          <Select
            id={`byline-${approval.id}`}
            name="bylineChoice"
            defaultValue={approval.penName ? "pen_name" : "real_name"}
            disabled={locked}
          >
            <option value="real_name">Gerçek ad — {approval.displayName}</option>
            {approval.penName && <option value="pen_name">Mahlas — {approval.penName}</option>}
          </Select>
        </Field>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="acknowledged"
            checked={acknowledged}
            disabled={locked}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line disabled:opacity-40"
          />
          <span>
            {statement}{" "}
            <Link href="/writer/agreement#madde-4" className="text-accent underline">
              Madde 4
            </Link>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="Onayla" variant="primary" disabled={locked || !acknowledged} />
          <Button
            type="button"
            variant="ghost"
            disabled={locked}
            onClick={() => setShowDecline((value) => !value)}
          >
            {showDecline ? "Reddetmekten vazgeç" : "Reddet"}
          </Button>
        </div>
      </form>

      {showDecline && (
        <form action={submitDecline} className="mt-4 space-y-3 border-t border-line pt-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="grantId" value={approval.id} />

          <Field
            label="Ret gerekçesi"
            htmlFor={`reason-${approval.id}`}
            hint="En az 10 karakter. Editöre iletilir ve eser revizyon durumuna döner."
          >
            <Textarea id={`reason-${approval.id}`} name="reason" required minLength={10} />
          </Field>

          <Submit label="Onayı reddet" variant="danger" disabled={locked} />
        </form>
      )}
    </div>
  );
}
