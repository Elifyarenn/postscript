/**
 * The one word count of an article body (D-330). The writer's and the
 * editor's forms count live in the browser, the lists and the licence form
 * count on the server, and all of them call this function so a writer never
 * sees one number while typing and another in the queue. Pure, without
 * imports, so it runs on both sides.
 *
 * Only the words a reader reads are counted: markdown marks, HTML tags,
 * entities, image references and link targets are not words.
 */
export function countWords(markdown: string | null | undefined): number {
  if (!markdown) return 0;
  const text = markdown
    // Comments and tags: raw HTML is never rendered (D-012), but pasted text
    // may still carry it and a tag is not a word
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // A reference definition ("[1]: https://…") is a target, not text
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, " ")
    .replace(/<?https?:\/\/\S+>?/g, " ")
    // "1." opening a numbered list item is a mark, not a number in the text
    .replace(/^(\s*(?:>\s*)*)\d+[.)](?=\s)/gm, "$1 ")
    // Hyphens inside a word ("e-posta") keep it one word; marks around it go
    .replace(/[#>*_`~|=+]/g, " ")
    .replace(/(^|\s)[-–—]+(?=\s|$)/g, " ");
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** "1.234 kelime", grouped the Turkish way. */
export function formatWordCount(count: number): string {
  return `${count.toLocaleString("tr-TR")} kelime`;
}
