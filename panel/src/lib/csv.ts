/**
 * CSV cells for the admin exports.
 *
 * A cell that starts like a formula gets a leading apostrophe: the actor
 * column of the audit export is a display name any member chooses, and Excel
 * runs `=HYPERLINK(…)` or `=cmd|…` in a cell even when it is quoted (D-248).
 */
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}
