import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { getPublicArticle } from "@/services/public";
import { listCommentsForArticle } from "@/services/community";
import { AuthorLinks } from "@/components/magazine";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  PageHeader,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { addCommentAction } from "@/app/community/actions";

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
  const csrfToken = (await readCsrfToken()) ?? "";
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

  // The public read model deliberately has no id; the comments anchor needs one
  const idRows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.slug, slug), isNull(articles.deletedAt)))
    .limit(1);
  const articleId = idRows[0]?.id ?? "";
  const comments = articleId ? await listCommentsForArticle(articleId) : [];

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

      <Card className="mt-6">
        <h2 className="mb-4 font-serif text-lg">Yorumlar ({comments.length})</h2>

        {comments.length === 0 ? (
          <EmptyState>Henüz yorum yok. İlk yorumu siz yazın!</EmptyState>
        ) : (
          <ul className="mb-6 space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-md border border-line bg-paper p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">
                    {comment.authorName ?? "Silinmiş kullanıcı"}
                  </span>
                  {comment.authorRole && <StatusBadge status={comment.authorRole} />}
                  <span className="text-muted">{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <PanelForm action={addCommentAction} csrfToken={csrfToken} submitLabel="Yorum yap">
          <input type="hidden" name="articleId" value={articleId} />
          <Field label="Yorumunuz" htmlFor="commentBody">
            <Textarea id="commentBody" name="body" required maxLength={2000} rows={3} />
          </Field>
        </PanelForm>
      </Card>
    </>
  );
}
