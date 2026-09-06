/**
 * Markdown rendering (DECISIONS.md D-012).
 *
 * Raw HTML inside markdown is not parsed, and the result is passed through
 * rehype-sanitize with its default GitHub schema. Editors write markdown, not
 * HTML, so nothing legitimate is lost by being strict here.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // allowDangerousHtml stays off: embedded HTML is dropped rather than sanitised
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source);
  return String(file);
}

/** Plain text version, used for PDF output and e-mail previews. */
export function markdownToPlainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, "") // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/[*_~`>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
