/**
 * Paragraphs for text pasted from Word or Google Docs (D-251).
 *
 * Markdown only starts a new paragraph after a blank line. Word's plain-text
 * clipboard separates paragraphs with a single line break, so a pasted
 * article used to render as one long block. Writers who had empty lines
 * between paragraphs in Word were unaffected, which is why only some
 * articles broke.
 */

// Word's plain-text bullets: "•", or "·" when the list uses the Symbol font
const WORD_BULLET = /^[ \t]*[•·▪◦][ \t]+/;
// Lines that belong together in markdown and must not be pulled apart
const LIST_ITEM = /^[ \t]*([-*+]|\d+[.)])[ \t]+/;
const QUOTE_LINE = /^[ \t]*>/;
const TABLE_ROW = /^[ \t]*\|/;
const FENCE = /^[ \t]*(```|~~~)/;

function groupOf(line: string): "list" | "quote" | "table" | null {
  if (LIST_ITEM.test(line)) return "list";
  if (QUOTE_LINE.test(line)) return "quote";
  if (TABLE_ROW.test(line)) return "table";
  return null;
}

/** Turns every single line break into a paragraph break. */
export function splitIntoParagraphs(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(WORD_BULLET, "- ").replace(/[ \t]+$/, ""));

  let out = "";
  let inFence = false;
  let previous: string | null = null;

  for (const line of lines) {
    if (inFence) {
      // Code keeps its own line breaks, blank lines included
      out += "\n" + line;
      if (FENCE.test(line)) inFence = false;
      previous = line;
      continue;
    }
    if (line.trim() === "") continue;

    const group = groupOf(line);
    if (previous !== null) {
      const sameGroup = group !== null && group === groupOf(previous);
      out += sameGroup ? "\n" : "\n\n";
    }
    // A Tab-indented first line in Word would otherwise render as a code block
    out += group === null && !FENCE.test(line) ? line.trimStart() : line;
    previous = line;
    if (FENCE.test(line)) inFence = true;
  }

  return out;
}
