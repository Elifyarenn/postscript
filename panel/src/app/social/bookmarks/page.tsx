import Link from "next/link";
import { Bookmark } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDate } from "@/lib/utils";
import { listBookmarkedArticles } from "@/services/social";
import { listBookmarkedPosts } from "@/services/posts";
import { ActionButton } from "@/components/form";
import { SiteTitle, Sparkle } from "@/components/site-ui";
import { EmptyState } from "@/components/ui";
import { PostList } from "@/components/social";
import { removeBookmarkAction } from "../actions";

export const metadata = { title: "Kaydedilenler" };

/** The private reading list, as the design's card board (D-113); nobody else can see it. */
export default async function BookmarksPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [articles, posts] = await Promise.all([
    listBookmarkedArticles({ ...user }),
    listBookmarkedPosts({ ...user }),
  ]);

  return (
    <>
      <SiteTitle description="Kaydettiklerinizi yalnızca siz görürsünüz.">Kaydedilenler</SiteTitle>

      <section aria-labelledby="saved-articles">
        <h2 id="saved-articles" className="site-subheading">
          Yazılar
        </h2>
        {articles.length === 0 ? (
          <EmptyState>
            Henüz kaydettiğiniz bir yazı yok. Yazı sayfalarındaki “Kaydet” düğmesini kullanın.
          </EmptyState>
        ) : (
          <ul className="bookmark-grid">
            {articles.map((article) => (
              <li key={article.articleId} className="bookmark-card">
                <span className="bookmark-cover" aria-hidden>
                  <Sparkle />
                </span>
                <h3 className="bookmark-title">
                  <Link href={`/magazine/articles/${article.slug}`}>{article.title}</Link>
                </h3>
                {article.summary && <p className="bookmark-summary">{article.summary}</p>}
                <div className="bookmark-foot">
                  <span>{article.publishedAt ? formatDate(article.publishedAt) : ""}</span>
                  <ActionButton
                    action={removeBookmarkAction}
                    csrfToken={csrfToken}
                    label="Çıkar"
                    variant="ghost"
                    className="bookmark-remove"
                    fields={{ articleId: article.articleId, slug: article.slug }}
                    display={<Bookmark aria-hidden className="size-5" fill="currentColor" />}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="saved-posts" className="mt-10">
        <h2 id="saved-posts" className="site-subheading">
          Gönderiler
        </h2>
        <PostList posts={posts} csrfToken={csrfToken} empty="Henüz kaydettiğiniz bir gönderi yok." />
      </section>
    </>
  );
}
