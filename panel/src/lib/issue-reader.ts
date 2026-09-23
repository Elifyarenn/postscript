/**
 * What the reader component is handed for one page (D-234, D-240).
 *
 * A plain, serialisable shape. Markdown is turned into sanitised HTML on the
 * server, so the browser never carries a parser and never sees anything that
 * was not cleaned first.
 *
 * A page is normally a designed picture with clickable areas on it. Pages laid
 * out from a template before D-240 have no picture and are still rendered from
 * their fields, so nothing already typed was lost.
 */
import type { PageBlock } from "./issue-blocks";
import type { ReaderHotspot } from "./issue-hotspots";
import type { ReaderQuiz } from "./issue-quiz";

export type ReaderArticle = {
  title: string;
  /** Only set when the article is published and may be opened. */
  slug: string | null;
  authorName: string | null;
  bodyHtml: string | null;
};

export type ReaderPage = {
  id: string;
  position: number;
  template: string;
  templateLabel: string;
  bleed: boolean;
  inContents: boolean;
  tocTitle: string | null;
  heading: string | null;
  standfirst: string | null;
  byline: string | null;
  bodyHtml: string | null;
  caption: string | null;
  section: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  /** The picture's natural size, so its shape is reserved before it arrives. */
  imageWidth: number | null;
  imageHeight: number | null;
  /** What the panel calls this page; the reader shows it to nobody. */
  label: string | null;
  /** Optional plain text of what the page shows, for a screen reader. */
  transcript: string | null;
  blocks: PageBlock[];
  /** Only the finished ones: an area that does nothing is never drawn. */
  hotspots: ReaderHotspot[];
  article: ReaderArticle | null;
  /** Resolved server side so a gallery does not have to guess addresses. */
  mediaUrls: Record<string, string>;
  /** The issue's own picks and playlist, for the pages that show them. */
  extras: ReaderExtras | null;
};

export type ReaderExtras = {
  picks: { kind: string; title: string; credit: string; year: number; text: string }[];
  playlist: { name: string | null; tracks: { title: string; artist: string; duration: string }[] } | null;
};

/** A page is its picture when it has one; otherwise it is its layout. */
export function isImagePage(page: Pick<ReaderPage, "imageUrl">): boolean {
  return page.imageUrl !== null;
}

/**
 * How the pages pair up in a spread.
 *
 * The cover stands alone on the right, as it does on a shelf, and every pair
 * after it is (2,3), (4,5) and so on. Returned as the index each spread starts
 * at, so the reader can step by spread and land in the right place from any
 * page — including one reached from the contents.
 */
export function spreadStartFor(index: number): number {
  if (index <= 0) return 0;
  // 1,2 → 1 · 3,4 → 3 · 5,6 → 5
  return index % 2 === 1 ? index : index - 1;
}

export type ReaderQuizzes = Record<string, ReaderQuiz>;
