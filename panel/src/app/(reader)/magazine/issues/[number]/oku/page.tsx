import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { isAppError } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { issueExtrasFor } from "@/lib/issue-extras";
import { templateOf } from "@/lib/issue-templates";
import type { ReaderExtras, ReaderPage } from "@/lib/issue-reader";
import { pageMediaUrl, readIssuePages } from "@/services/issue-pages";
import { MagazineReader } from "@/components/magazine-reader";

export const metadata = { title: "Dergi", robots: { index: false, follow: false } };

const PICK_LABELS: Record<string, string> = {
  movie: "Sayının filmi",
  series: "Sayının dizisi",
  book: "Sayının kitabı",
  artwork: "Sayının eseri",
};

/**
 * The magazine reader (D-234, D-236).
 *
 * Whether this reader may be opened at all is decided in `readIssuePages`, not
 * here: an unpublished issue answers 404 to everyone outside the panel, and
 * the working issue answers 404 to everyone but an admin. The pictures are
 * fetched through the page's own guarded route, so they are as closed as the
 * issue is.
 *
 * Markdown belongs to the older template pages and is turned into sanitised
 * HTML here, on the server, so the browser carries no parser.
 */
export default async function IssueReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { user } = await requireSession();
  const [{ number }, query] = await Promise.all([params, searchParams]);

  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();

  const reader = await readIssuePages({ ...user }, parsed).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  const extrasSource = issueExtrasFor(reader.issue.number);
  const extras: ReaderExtras | null = extrasSource
    ? {
        picks: (extrasSource.cards ?? []).map((card) => ({
          kind: PICK_LABELS[card.kind] ?? card.kind,
          title: card.title,
          credit: card.credit,
          year: card.year,
          text: card.text,
        })),
        playlist: extrasSource.playlist
          ? {
              name: extrasSource.playlist.name ?? null,
              tracks: extrasSource.playlist.tracks ?? [],
            }
          : null,
      }
    : null;

  const pages: ReaderPage[] = await Promise.all(
    reader.pages.map(async (page) => {
      const template = templateOf(page.template);
      // Only the pages that show them carry the issue's picks and playlist
      const wantsExtras = page.template === "picks" || page.template === "playlist";
      const hasPlaylistBlock = page.blocks.some((block) => block.kind === "playlist");

      return {
        id: page.id,
        position: page.position,
        template: page.template,
        templateLabel: template.label,
        bleed: template.bleed ?? false,
        inContents: page.inContents,
        tocTitle: page.tocTitle,
        heading: page.heading,
        standfirst: page.standfirst,
        byline: page.byline,
        bodyHtml: page.body ? await renderMarkdown(page.body) : null,
        caption: page.caption,
        section: page.section,
        imageUrl: page.imageUrl,
        imageAlt: page.imageAlt,
        imageWidth: page.imageWidth,
        imageHeight: page.imageHeight,
        label: page.label,
        transcript: page.transcript,
        blocks: page.blocks,
        hotspots: page.hotspots,
        article: page.article
          ? {
              title: page.article.title,
              slug: page.article.slug,
              authorName: page.article.authorName,
              bodyHtml: page.article.body ? await renderMarkdown(page.article.body) : null,
            }
          : null,
        // Block pictures go through the page's own guarded route as well
        mediaUrls: Object.fromEntries(
          page.blocks.flatMap((block) => {
            if (block.kind === "zoom" && block.mediaId) {
              return [[block.mediaId, pageMediaUrl(page.id, block.mediaId)]];
            }
            if (block.kind === "gallery") {
              return block.mediaIds.map((id) => [id, pageMediaUrl(page.id, id)]);
            }
            return [];
          }),
        ),
        extras: wantsExtras || hasPlaylistBlock ? extras : null,
      };
    }),
  );

  return (
    <MagazineReader
      issueNumber={reader.issue.number}
      issueTitle={reader.issue.title}
      theme={reader.issue.theme}
      pages={pages}
      quizzes={reader.quizzes}
      preview={reader.preview}
      adminOnly={reader.issue.adminOnly}
      startPageId={query.s ?? null}
      backHref={`/magazine/issues/${reader.issue.number}`}
    />
  );
}
