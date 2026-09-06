"use client";

/**
 * Drag and drop ordering for the articles inside an issue (§9.2).
 *
 * Uses the native HTML drag and drop API rather than a library, and posts the
 * whole order in one field so the server writes it in a single transaction.
 * Up and down buttons are there too, because dragging is awkward with a
 * keyboard or on a phone.
 */
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, Button, EmptyState, StatusBadge } from "@/components/ui";
import type { ActionState, ServerAction } from "@/components/form";

type Row = { id: string; title: string; status: string };

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Sıralamayı kaydet"}
    </Button>
  );
}

export function IssueOrder({
  action,
  csrfToken,
  issueId,
  articles,
}: {
  action: ServerAction;
  csrfToken: string;
  issueId: string;
  articles: Row[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  const [rows, setRows] = useState<Row[]>(articles);
  const [dragging, setDragging] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setRows(next);
  }

  if (rows.length === 0) {
    return <EmptyState>Bu sayıya makale atanmadı.</EmptyState>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="issueId" value={issueId} />
      <input type="hidden" name="order" value={rows.map((row) => row.id).join(",")} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <ol className="space-y-1.5">
        {rows.map((row, index) => (
          <li
            key={row.id}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging !== null) move(dragging, index);
              setDragging(null);
            }}
            className="flex cursor-grab items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm active:cursor-grabbing"
          >
            <span className="w-5 shrink-0 text-xs text-muted">{index + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{row.title}</span>
            <StatusBadge status={row.status} />

            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label="Yukarı taşı"
                className="rounded border border-line px-1.5 text-xs disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === rows.length - 1}
                aria-label="Aşağı taşı"
                className="rounded border border-line px-1.5 text-xs disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      <Save />
    </form>
  );
}
