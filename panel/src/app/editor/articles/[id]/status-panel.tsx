"use client";

/**
 * Status transition controls.
 *
 * Only the targets the state machine allows from the current status are shown,
 * and two of them need an extra input: a schedule needs a date, a withdrawal
 * needs a reason. Both are still validated on the server.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, Field, Input, Textarea, STATUS_LABELS } from "@/components/ui";
import type { ActionState, ServerAction } from "@/components/form";

/**
 * The wording of the transition buttons, in the product's own words (D-059,
 * D-068): the category editor asks for a revision or passes the article on to
 * the main editor, the main editor approves it into the admin's publication
 * queue, and the admin accepts, schedules or publishes.
 */
const TRANSITION_LABELS: Record<string, string> = {
  draft: "Taslağa Dön",
  in_review: "İncelemeye Gönder",
  pending_admin_approval: "Onayla ve Ana Editöre Gönder",
  ready_for_publishing: "Onayla",
  accepted: "Kabul Et",
  revision_requested: "Revizyon İste",
  scheduled: "Yayına Al",
  published: "Hemen Yayınla",
  archived: "Arşivle",
  withdrawn: "Geri Çek",
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uygulanıyor…" : label}
    </Button>
  );
}

export function StatusPanel({
  action,
  csrfToken,
  articleId,
  currentStatus,
  targets,
}: {
  action: ServerAction;
  csrfToken: string;
  articleId: string;
  currentStatus: string;
  targets: readonly string[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [selected, setSelected] = useState<string | null>(null);

  if (targets.length === 0) {
    return (
      <Alert tone="info">
        &ldquo;{STATUS_LABELS[currentStatus] ?? currentStatus}&rdquo; son durumdur; buradan başka
        bir duruma geçilemez.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <div className="flex flex-wrap gap-2">
        {targets.map((target) => (
          <Button
            key={target}
            type="button"
            variant={selected === target ? "primary" : "secondary"}
            onClick={() => setSelected(selected === target ? null : target)}
          >
            {TRANSITION_LABELS[target] ?? STATUS_LABELS[target] ?? target}
          </Button>
        ))}
      </div>

      {selected && (
        <form action={formAction} className="space-y-4 border-t border-line pt-4">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="articleId" value={articleId} />
          <input type="hidden" name="status" value={selected} />

          {selected === "scheduled" && (
            <Field
              label="Yayın zamanı"
              htmlFor="scheduledAt"
              hint="Boş bırakılırsa hemen yayına alınabilir duruma geçer."
            >
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </Field>
          )}

          {selected === "withdrawn" && (
            <Field
              label="Geri çekme gerekçesi"
              htmlFor="withdrawnReason"
              hint="Zorunludur ve kayıt altına alınır."
            >
              <Textarea id="withdrawnReason" name="withdrawnReason" required minLength={3} />
            </Field>
          )}

          {selected === "revision_requested" && (
            <Field label="Yazara iletilecek not" htmlFor="note">
              <Textarea id="note" name="note" />
            </Field>
          )}

          <Submit
            label={`"${TRANSITION_LABELS[selected] ?? STATUS_LABELS[selected] ?? selected}" durumuna geç`}
          />
        </form>
      )}
    </div>
  );
}
