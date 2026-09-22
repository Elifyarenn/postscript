/**
 * What the reader component is handed for one page (D-234).
 *
 * A plain, serialisable shape: the markdown is turned into sanitised HTML on
 * the server, so the browser never carries a markdown parser and never sees
 * anything that was not cleaned first.
 */
import type { PageBlock } from "./issue-blocks";

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
  blocks: PageBlock[];
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
