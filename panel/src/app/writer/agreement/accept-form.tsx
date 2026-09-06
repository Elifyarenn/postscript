"use client";

/**
 * Contract acceptance with the read gate from §6.2.
 *
 * The confirm control stays shut until the last paragraph has actually been on
 * screen — watched with an IntersectionObserver rather than a scroll position,
 * so it works the same whether the reader scrolls, drags the bar or uses a
 * keyboard. A text short enough to need no scrolling counts as read, otherwise
 * the gate could never open.
 *
 * This is a courtesy, not the guarantee: the server renders the contract again
 * and refuses the acceptance if its hash differs from the one echoed here.
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
  renderedHash,
  html,
}: {
  action: ServerAction;
  csrfToken: string;
  agreementVersionId: string;
  renderedHash: string;
  html: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [checked, setChecked] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = endRef.current;
    if (!container || !sentinel) return;

    // Nothing to scroll: the whole text is already visible
    if (container.scrollHeight <= container.clientHeight + 24) {
      setReachedEnd(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setReachedEnd(true);
      },
      { root: container, threshold: 0.5 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [html]);

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="max-h-[30rem] overflow-y-auto rounded-md border border-line bg-surface p-5"
      >
        {/* Rendered and sanitised on the server */}
        <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        {/* Watched by the observer above: reaching this means the end was seen */}
        <div ref={endRef} aria-hidden className="h-px" />
      </div>

      {!reachedEnd && (
        <p className="text-xs text-muted">
          Onay kutusu, metnin sonuna kadar okuduğunuzda etkinleşir.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="agreementVersionId" value={agreementVersionId} />
        {/* Echoed back; the server re-renders and compares before accepting */}
        <input type="hidden" name="renderedHash" value={renderedHash} />

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
