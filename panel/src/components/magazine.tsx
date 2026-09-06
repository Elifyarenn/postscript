import Link from "next/link";
import { formatDate } from "@/lib/utils";

/**
 * The pieces the reading screens share.
 *
 * Kept in one place because an article appears in three lists — the front page,
 * an issue's contents and an author's page — and they must look the same.
 */

export type ArticleCardProps = {
  title: string;
  slug: string;
  summary?: string | null;
  author?: string | null;
  authorSlug?: string | null;
  issueNumber?: number | null;
  publishedAt?: Date | string | null;
};

export function ArticleCard({
  title,
  slug,
  summary,
  author,
  authorSlug,
  issueNumber,
  publishedAt,
}: ArticleCardProps) {
  return (
    <article className="border-b border-line py-5 last:border-b-0">
      <h3 className="font-serif text-lg">
        <Link href={`/magazine/articles/${slug}`} className="hover:text-accent">
          {title}
        </Link>
      </h3>

      {summary && <p className="mt-1 text-sm text-muted">{summary}</p>}

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {author &&
          (authorSlug ? (
            <Link href={`/magazine/authors/${authorSlug}`} className="hover:text-ink">
              {author}
            </Link>
          ) : (
            <span>{author}</span>
          ))}
        {typeof issueNumber === "number" && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/magazine/issues/${issueNumber}`} className="hover:text-ink">
              Sayı {issueNumber}
            </Link>
          </>
        )}
        {publishedAt && (
          <>
            <span aria-hidden>·</span>
            <span>{formatDate(publishedAt)}</span>
          </>
        )}
      </p>
    </article>
  );
}

/** The social accounts an author chose to show (§6.2). */
export function AuthorLinks({ links }: { links: unknown }) {
  if (!links || typeof links !== "object") return null;

  const entries = Object.entries(links as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
  );
  if (entries.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-wrap gap-3 text-xs">
      {entries.map(([platform, url]) => (
        <li key={platform}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-muted hover:text-ink"
          >
            {PLATFORM_LABELS[platform] ?? platform}
          </a>
        </li>
      ))}
    </ul>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  substack: "Substack",
};
