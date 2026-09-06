import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getPublicArticle } from "@/services/public";
import { AuthorLinks } from "@/components/magazine";
import { Alert, Card, PageHeader } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Yazı" };

/**
 * One published article, read.
 *
 * A withdrawn article is told plainly rather than hidden: the public API answers
 * 410 for the same slug (§8), and a reader who followed a link deserves the same
 * answer in words.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;

  let article: Awaited<ReturnType<typeof getPublicArticle>>;
  try {
    article = await getPublicArticle(slug);
  } catch (error: unknown) {
    if (isAppError(error) && error.status === 410) {
      return (
        <Alert tone="warning" title="Bu yazı geri çekildi">
          Yazı yayından kaldırıldı ve artık okunamıyor.
        </Alert>
      );
    }
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  const tags = Array.isArray(article.tags) ? (article.tags as string[]) : [];

  return (
    <>
      <PageHeader title={article.title} description={article.summary ?? undefined} />

      <p className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {article.author &&
          (article.author.slug ? (
            <Link href={`/magazine/authors/${article.author.slug}`} className="hover:text-ink">
              {article.author.name}
            </Link>
          ) : (
            <span>{article.author.name}</span>
          ))}
        {typeof article.issueNumber === "number" && (
          <>
            <span aria-hidden>·</span>
            <Link href={`/magazine/issues/${article.issueNumber}`} className="hover:text-ink">
              Sayı {article.issueNumber}
            </Link>
          </>
        )}
        {article.publishedAt && (
          <>
            <span aria-hidden>·</span>
            <span>{formatDate(article.publishedAt)}</span>
          </>
        )}
        {article.category && (
          <>
            <span aria-hidden>·</span>
            <span>{article.category}</span>
          </>
        )}
      </p>

      <Card>
        {/* Sanitised by rehype-sanitize in renderMarkdown (D-012) */}
        <div className="prose-panel" dangerouslySetInnerHTML={{ __html: article.html }} />
      </Card>

      {tags.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2 py-0.5">
              {tag}
            </span>
          ))}
        </p>
      )}

      {article.author && (
        <Card className="mt-6">
          <h2 className="font-serif text-base">{article.author.name}</h2>
          {article.author.bio && <p className="mt-1 text-sm text-muted">{article.author.bio}</p>}
          <AuthorLinks links={article.author.socialLinks} />
          {article.author.slug && (
            <p className="mt-3 text-sm">
              <Link href={`/magazine/authors/${article.author.slug}`} className="text-accent">
                Bu yazarın bütün yazıları
              </Link>
            </p>
          )}
        </Card>
      )}
    </>
  );
}
