import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles } from "@/db/schema";
import { readerSession } from "@/lib/auth/guard";
import { env } from "@/lib/env";
import { NO_INDEX, pageMetadata } from "@/lib/seo";
import { buildArticleJsonLd, JsonLd } from "@/components/site-json-ld";
import { getPublicArticle } from "@/services/public";
import { listCommentsForArticle } from "@/services/community";
import { isArticleBookmarked } from "@/services/social";
import { AuthorLinks } from "@/components/magazine";
import { ActionButton, PanelForm } from "@/components/form";
import { bookmarkArticleAction, removeBookmarkAction } from "@/app/social/actions";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PersonName,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { addCommentAction } from "@/app/community/actions";

/**
 * The article, or why there is none. One query per request for the metadata
 * and the page alike.
 */
const loadArticle = cache(async (slug: string) => {
  try {
    return { article: await getPublicArticle(slug), status: 200 as const };
  } catch (error: unknown) {
    if (isAppError(error) && (error.status === 404 || error.status === 410)) {
      return { article: null, status: error.status as 404 | 410 };
    }
    throw error;
  }
});

/**
 * Title, description, canonical and share card from the public read model
 * (D-257). A missing, unpublished or withdrawn article is kept out of search.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { article } = await loadArticle((await params).slug);
  if (!article) return { title: "Yazı", robots: NO_INDEX };

  return pageMetadata({
    title: article.title,
    description: article.summary ?? `${article.title} — PostScript Dergi${article.author ? `, ${article.author.name}` : ""}.`,
    path: `/magazine/articles/${article.slug}`,
    article: {
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      authors: article.author?.slug ? [`/magazine/authors/${article.author.slug}`] : undefined,
      section: article.category ?? undefined,
    },
  });
}

/**
 * One published article, read. Public (D-257): comments and bookmarks are the
 * members' part and appear only with a session.
 *
 * A withdrawn article is told plainly rather than hidden: the public API answers
 * 410 for the same slug (§8), and a reader who followed a link deserves the same
 * answer in words.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [context, loaded, csrfToken] = await Promise.all([
    readerSession(),
    loadArticle(slug),
    readCsrfToken().then((token) => token ?? ""),
  ]);

  if (loaded.status === 410) {
    return (
      <Alert tone="warning" title="Bu yazı geri çekildi">
        Yazı yayından kaldırıldı ve artık okunamıyor.
      </Alert>
    );
  }
  if (!loaded.article) notFound();
  const article = loaded.article;
  const user = context?.user ?? null;

  // The public read model deliberately has no id; the comments anchor needs one
  const idRows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.slug, slug), isNull(articles.deletedAt)))
    .limit(1);
  const articleId = idRows[0]?.id ?? "";
  // Comments carry members' names, so they stay with the members (D-257)
  const [comments, bookmarked] =
    articleId && user
      ? await Promise.all([listCommentsForArticle(articleId), isArticleBookmarked({ ...user }, articleId)])
      : [[], false];

  return (
    <>
      <JsonLd
        data={buildArticleJsonLd(env().SITE_URL, {
          ...article,
          author: article.author ? { name: article.author.name, slug: article.author.slug } : null,
        })}
      />
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

      {articleId && user && (
        <div className="mb-6">
          <ActionButton
            action={bookmarked ? removeBookmarkAction : bookmarkArticleAction}
            csrfToken={csrfToken}
            label={bookmarked ? "Kaydedildi · kaldır" : "Kaydet"}
            fields={{ articleId, slug }}
          />
        </div>
      )}

      <Card>
        {/* Sanitised by rehype-sanitize in renderMarkdown (D-012) */}
        <div className="prose-panel" dangerouslySetInnerHTML={{ __html: article.html }} />
      </Card>

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

      {!user && (
        <Card className="mt-6">
          <h2 className="mb-2 font-serif text-lg">Yorumlar</h2>
          <p className="text-sm">
            Yorumları okumak, yorum yazmak ve yazıyı kaydetmek için{" "}
            <Link href="/login" className="text-accent underline">
              giriş yapın
            </Link>{" "}
            ya da{" "}
            <Link href="/register" className="text-accent underline">
              ücretsiz üye olun
            </Link>
            .
          </p>
        </Card>
      )}

      {user && (
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
                      <PersonName
                        person={{
                          penName: comment.authorPenName,
                          penNameSlug: comment.authorPenNameSlug,
                          username: comment.authorUsername,
                        }}
                        name={comment.authorName}
                        fallback="Silinmiş kullanıcı"
                      />
                    </span>
                    {comment.authorRole && <StatusBadge status={comment.authorRole} />}
                    <span className="text-muted">{formatDateTime(comment.createdAt)}</span>
                    <Link
                      href={`/social/report?type=comment&id=${comment.id}`}
                      className="ml-auto text-muted hover:text-danger"
                    >
                      Bildir
                    </Link>
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
      )}
    </>
  );
}
