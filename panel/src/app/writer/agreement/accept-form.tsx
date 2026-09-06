"use client";

/**
 * Agreement acceptance with the scroll gate from §7.1.
 *
 * The full text is shown in a scrollable panel and the confirm control stays
 * disabled until the reader reaches the bottom. This is a courtesy, not the
 * guarantee: the server still compares the hash of the text that was displayed
 * with the hash of the stored version before it records anything.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button } from "@/components/ui";
import type { ActionState, ServerAction } from "@/components/form";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Kaydediliyor…" : "Okudum, anladım, kabul ediyorum"}
    </Button>
  );
}

export function AgreementAcceptForm({
  action,
  csrfToken,
  agreementVersionId,
  bodyHash,
  html,
}: {
  action: ServerAction;
  csrfToken: string;
  agreementVersionId: string;
  bodyHash: string;
  html: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    // A few pixels of tolerance, because sub-pixel heights never land exactly
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
    if (atBottom) setReachedEnd(true);
  }

  // A text short enough to fit without scrolling has already been seen in full,
  // and would otherwise never fire a scroll event and never unlock the checkbox
  useEffect(() => {
    const element = scrollRef.current;
    if (element && element.scrollHeight <= element.clientHeight + 24) setReachedEnd(true);
  }, [html]);

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="prose-panel max-h-[28rem] overflow-y-auto rounded-md border border-line bg-surface p-5 text-sm"
        // Rendered and sanitised on the server
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {!reachedEnd && (
        <p className="text-xs text-muted">
          Onay kutusu, metnin sonuna kadar okuduğunuzda etkinleşir.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="agreementVersionId" value={agreementVersionId} />
        <input type="hidden" name="bodyHash" value={bodyHash} />

        {state?.error && <Alert tone="danger">{state.error}</Alert>}
        {state?.success && <Alert tone="success">{state.success}</Alert>}

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="acknowledged"
            disabled={!reachedEnd}
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-0.5 size-4 rounded border-line disabled:opacity-40"
          />
          <span className={reachedEnd ? "" : "text-muted"}>
            Sözleşmenin tamamını okudum, anladım ve kabul ediyorum.
          </span>
        </label>

        <SubmitButton disabled={!reachedEnd || !checked} />
      </form>
    </div>
  );
}
