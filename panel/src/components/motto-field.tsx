"use client";

/**
 * The team form's line, with ready suggestions for what the member does (D-227).
 *
 * The field stays free text; a suggestion only fills it in, and the counter
 * says how much of the limit is left, because the limit is short enough to
 * run into.
 */
import { useState } from "react";
import type { MottoGroup } from "@/lib/motto-suggestions";
import { Input } from "@/components/ui";

export function MottoField({
  groups,
  defaultValue,
  max,
}: {
  groups: MottoGroup[];
  defaultValue: string;
  max: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const many = groups.length > 1;

  return (
    <>
      <Input
        id="motto"
        name="motto"
        maxLength={max}
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Tek cümle, sizden bir şey"
      />
      <p className="mt-1 text-right text-xs text-muted" aria-hidden>
        {value.length}/{max}
      </p>

      {groups.length > 0 && (
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted">
            Hazır bir söz seçip üzerinde oynayabilirsiniz:
          </p>
          {groups.map((group) => (
            <div key={group.id}>
              {many && (
                <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.lines.map((line) => (
                  <li key={line}>
                    <button
                      type="button"
                      onClick={() => setValue(line)}
                      aria-pressed={value === line}
                      className="w-full rounded-md border border-line bg-paper px-3 py-1.5 text-left text-xs text-ink hover:border-accent aria-pressed:border-accent aria-pressed:bg-surface"
                    >
                      {line}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
