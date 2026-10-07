/**
 * The issue choice every article list starts with (D-330). A plain GET form:
 * the page reads `?issueId=` on the server, so the filter works without
 * JavaScript and the server never trusts it beyond picking a visible issue.
 * There is deliberately no "Tümü": two issues' articles never share a list.
 */
import type { ReactNode } from "react";
import { Field, Select } from "./ui";

export type PickerIssue = { id: string; number: number; title: string };

export function issueLabel(issue: PickerIssue, activeId: string | null): string {
  return `Sayı ${issue.number} · ${issue.title}${issue.id === activeId ? " (aktif sayı)" : ""}`;
}

export function IssuePicker({
  issues,
  selectedId,
  activeId,
  hidden = {},
  children,
}: {
  issues: readonly PickerIssue[];
  selectedId: string;
  activeId: string | null;
  /** Other filters the list keeps when the issue changes. */
  hidden?: Record<string, string | undefined>;
  /** More fields for the same form (search, status, order). */
  children?: ReactNode;
}) {
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <Field label="Sayı" htmlFor="issueId">
        <Select id="issueId" name="issueId" defaultValue={selectedId}>
          {issues.map((issue) => (
            <option key={issue.id} value={issue.id}>
              {issueLabel(issue, activeId)}
            </option>
          ))}
        </Select>
      </Field>
      {children}
      <div className="flex items-end">
        <button
          type="submit"
          className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm hover:bg-paper"
        >
          Uygula
        </button>
      </div>
    </form>
  );
}
