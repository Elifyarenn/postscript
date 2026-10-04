/**
 * What the reader asks of a page's blocks (D-234, D-309), apart from their zod
 * schemas in `issue-blocks.ts`: the reader is a client component, and pulling
 * the schemas in shipped zod (some 85 KB) to every reader's browser (D-313).
 */
import type { PageBlock } from "./issue-blocks";

/**
 * Whether a block has enough in it to show a reader. An empty one is a gap the
 * editor still has to fill, not something to put in front of anybody.
 */
export function blockIsReady(block: PageBlock): boolean {
  switch (block.kind) {
    case "zoom":
      return block.mediaId !== null;
    case "gallery":
      return block.mediaIds.length > 0;
    case "aside":
      return block.body !== "";
    case "quote":
      return block.text !== "";
    case "related":
      return block.articleId !== null;
    case "media":
      return block.url !== "";
    case "playlist":
      return true;
    case "quiz":
      return block.question !== "" && block.options.length >= 2 && block.answer !== null;
    case "test":
      return block.quizId !== null;
  }
}

/** The quiz a page lays out, when it is a test page (D-309). */
export function testQuizId(blocks: PageBlock[]): string | null {
  for (const block of blocks) if (block.kind === "test" && block.quizId) return block.quizId;
  return null;
}
