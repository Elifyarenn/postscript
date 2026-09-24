/**
 * Getting an article's own words onto a fixed-size page (D-247).
 *
 * A page picture cannot scroll, so the text is measured before it is drawn:
 * whole paragraphs while they fit, then the last one cut at a sentence (or at
 * least a word) and marked with an ellipsis. Nothing is reworded, reordered or
 * added — the only change to the writer's text is where it stops, and every
 * page that stops early says it is a preview selection.
 */
import { markdownToPlainText } from "@/lib/markdown";

/** Turkish-aware comparison key for titles typed with varying care. */
export function titleKey(title: string): string {
  return title
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ı]+/g, " ")
    .trim();
}

/** True when two titles name the same article, allowing a trimmed subtitle. */
export function sameTitle(stored: string, wanted: string): boolean {
  const a = titleKey(stored);
  const b = titleKey(wanted);
  if (a === "" || b === "") return false;
  if (a === b) return true;
  // "Başlık" and "Başlık: alt başlık" — only when the shorter one is not trivial
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.length >= 8 && longer.startsWith(`${shorter} `);
}

/** The article's paragraphs as plain text, in order, with headings kept as lines. */
export function paragraphsOf(markdown: string): string[] {
  return markdownToPlainText(markdown)
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter((block) => block.length > 0);
}

/**
 * How many characters a text box holds. Source Serif at these sizes averages
 * about 0.42em a character (measured on the rendered pages); 0.45em and a 10%
 * margin keep it cautious, because running out of room shows as text cut
 * mid-line, while a short box only leaves a little paper.
 */
export type TextBox = { width: number; height: number; fontSize: number; lineHeight: number };

function perLine(box: TextBox): number {
  return Math.floor(box.width / (box.fontSize * 0.45));
}

export function capacity(box: TextBox): number {
  const chars = perLine(box);
  const lines = Math.floor(box.height / (box.fontSize * box.lineHeight));
  // Each paragraph ends with a part-filled line; the margin pays for those
  return Math.max(0, Math.floor(chars * lines * 0.9));
}

/** Cuts one paragraph to at most `budget` characters, at a sentence if possible. */
function cutParagraph(text: string, budget: number): string | null {
  if (budget < 60) return null;
  const head = text.slice(0, budget);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  if (sentenceEnd > budget * 0.5) return `${head.slice(0, sentenceEnd + 1)} …`;
  const wordEnd = head.lastIndexOf(" ");
  if (wordEnd <= 0) return null;
  return `${head.slice(0, wordEnd).replace(/[,;:–—-]$/, "")} …`;
}

export type Fitted = { paragraphs: string[]; used: number; complete: boolean };

/**
 * Takes paragraphs from `from` while they fit in the box. A paragraph break
 * costs its half-empty last line and the gap under it: charged as 1.2 lines.
 * `used` says how many source paragraphs were consumed, so the next box can
 * carry on where this one stopped.
 */
export function fitParagraphs(source: string[], from: number, box: TextBox): Fitted {
  const out: string[] = [];
  const breakCost = Math.ceil(perLine(box) * 1.2);
  let left = capacity(box);
  let index = from;

  while (index < source.length) {
    const paragraph = source[index]!;
    if (paragraph.length <= left) {
      out.push(paragraph);
      left -= paragraph.length + breakCost;
      index += 1;
      continue;
    }
    const cut = cutParagraph(paragraph, left);
    if (cut) out.push(cut);
    // A cut paragraph is not carried over: the next box starts clean
    return { paragraphs: out, used: index + 1 - from, complete: false };
  }
  return { paragraphs: out, used: index - from, complete: true };
}

/**
 * A sentence from the article to set large, word for word. The first one of a
 * readable length, so the quote is the writer's and not a paraphrase of it.
 */
export function pickQuote(paragraphs: string[], min = 70, max = 180): string | null {
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/(?<=[.!?…])\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length >= min && trimmed.length <= max && !trimmed.endsWith(":")) return trimmed;
    }
  }
  return null;
}

/** Caps for labels, the Turkish way ("bilim" → "BİLİM"). */
export function upperTr(text: string): string {
  return text.toLocaleUpperCase("tr");
}

/** Shortens a one-line field to a word boundary. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const at = head.lastIndexOf(" ");
  return `${(at > max * 0.6 ? head.slice(0, at) : head).replace(/[,;:–—-]$/, "")}…`;
}
