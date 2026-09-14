/**
 * A line-based text diff for comparing article versions (D-108).
 *
 * Markdown is written line by line, so lines are the unit an editor recognises.
 * The longest-common-subsequence table costs n·m cells; an article is a few
 * hundred lines, and a comparison above the cell budget is declined rather than
 * letting a single page request tie up the server.
 */

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** A run of unchanged lines folded away, so a long article shows only its changes. */
export type DiffItem = DiffLine | { kind: "skipped"; count: number };

/** Roughly 2 000 × 2 000 changed lines; far past any real article. */
export const DIFF_CELL_BUDGET = 4_000_000;

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/** Every line of `after`, marked against `before`; null when the texts are too large to compare. */
export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = splitLines(before);
  const b = splitLines(after);

  // Most edits touch the middle, so the common head and tail never enter the table
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  if (n * m > DIFF_CELL_BUDGET) return null;

  // lcs[i][j] is the common-subsequence length of midA[i..] and midB[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = lcs[i]!;
    const below = lcs[i + 1]!;
    for (let j = m - 1; j >= 0; j -= 1) {
      row[j] = midA[i] === midB[j] ? below[j + 1]! + 1 : Math.max(below[j]!, row[j + 1]!);
    }
  }

  const lines: DiffLine[] = a.slice(0, start).map((text) => ({ kind: "same", text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      lines.push({ kind: "same", text: midA[i]! });
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      lines.push({ kind: "removed", text: midA[i]! });
      i += 1;
    } else {
      lines.push({ kind: "added", text: midB[j]! });
      j += 1;
    }
  }
  for (; i < n; i += 1) lines.push({ kind: "removed", text: midA[i]! });
  for (; j < m; j += 1) lines.push({ kind: "added", text: midB[j]! });
  for (const text of a.slice(endA)) lines.push({ kind: "same", text });

  return lines;
}

/** Keeps `context` unchanged lines around each change and folds the rest. */
export function foldUnchanged(lines: DiffLine[], context = 2): DiffItem[] {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k += 1) {
      keep[k] = true;
    }
  });

  const items: DiffItem[] = [];
  let skipped = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (skipped > 0) items.push({ kind: "skipped", count: skipped });
      skipped = 0;
      items.push(line);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) items.push({ kind: "skipped", count: skipped });
  return items;
}

export function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "added") added += 1;
    if (line.kind === "removed") removed += 1;
  }
  return { added, removed };
}
