"use client";

/**
 * The admin's own tick on a team avatar card (D-232).
 *
 * A form of its own rather than a checkbox inside the ZIP form: the two mean
 * different things, and a checkbox that only counts when something else is
 * submitted would be a trap. Ticking submits straight away, and the page is
 * revalidated, so the card moves to its new place by itself.
 */
import { useActionState } from "react";
import type { ActionState } from "@/lib/action";
import { setTeamAvatarProcessedAction } from "./actions";

export function ProcessedToggle({
  avatarId,
  csrfToken,
  done,
}: {
  avatarId: string;
  csrfToken: string;
  done: boolean;
}) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(
    setTeamAvatarProcessedAction,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="avatarId" value={avatarId} />
      {/* Where the tick is going, so a double click cannot land on the old value */}
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={done}
          disabled={pending}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="h-4 w-4"
        />
        Postunu yaptım
      </label>
    </form>
  );
}
