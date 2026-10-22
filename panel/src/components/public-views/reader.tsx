import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { CARD_LABELS, issueExtrasFor } from "@/lib/issue-extras";
import { templateOf } from "@/lib/issue-templates";
import type { ReaderExtras, ReaderPage } from "@/lib/issue-reader";
import { readIssuePages } from "@/services/issue-pages";
import { MagazineReader } from "@/components/magazine-reader";

/**
 * The magazine reader (D-234, D-240).
 *
 * Whether this reader may be opened at all is decided in `readIssuePages`, not
 * here: a published issue is open to everyone (D-257), an unpublished issue
 * answers 404 to everyone outside the panel, and
 * the working issue answers 404 to everyone but an admin. The pictures are
 * fetched through the page's own guarded route, so they are as closed as the
 * issue is.
 *
 * Markdown belongs to the older template pages and is turned into sanitised
 * HTML here, on the server, so the browser carries no parser.
 */
export async function ReaderView({
  number,
  user,
  startPageId,
}: {
  number: string;
  /** null for the cached copy visitors without a session get (D-354). */
  user: SessionUser | null;
  /** `?s=`: the page a link opens at; the cached copy has none. */
  startPageId: string | null;
}) {

  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) notFound();

  const reader = await readIssuePages(user ? { ...user } : null, parsed).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  const extrasSource = issueExtrasFor(reader.issue.number);
  const extras: ReaderExtras | null = extrasSource
    ? {
        picks: (extrasSource.cards ?? []).map((card) => ({
          kind: CARD_LABELS[card.kind] ?? card.kind,
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
        // Block pictures follow the page picture: the guarded route, or the public copy (D-353)
        mediaUrls: Object.fromEntries(
          page.blocks.flatMap((block) => {
            if (block.kind === "zoom" && block.mediaId) {
              return [[block.mediaId, reader.pictureUrl(page.id, block.mediaId)]];
            }
            if (block.kind === "gallery") {
              return block.mediaIds.map((id) => [id, reader.pictureUrl(page.id, id)]);
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
      startPageId={startPageId}
      backHref={`/magazine/issues/${reader.issue.number}`}
    />
  );
}
