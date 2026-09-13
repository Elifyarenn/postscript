import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listBookmarkedArticles } from "@/services/social";
import { listBookmarkedPosts } from "@/services/posts";
import { ActionButton } from "@/components/form";
import { ArticleCard } from "@/components/magazine";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PostList } from "@/components/social";
import { removeBookmarkAction } from "../actions";

export const metadata = { title: "Kaydedilenler" };

/** The private reading list; nobody else can see it. */
export default async function BookmarksPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [articles, posts] = await Promise.all([
    listBookmarkedArticles({ ...user }),
    listBookmarkedPosts({ ...user }),
  ]);

  return (
    <>
      <PageHeader title="Kaydedilenler" description="Kaydettiklerinizi yalnızca siz görürsünüz." />

      <div className="space-y-6">
        <Card>
          <h2 className="font-serif text-lg">Yazılar</h2>
          {articles.length === 0 ? (
            <div className="mt-3">
              <EmptyState>Henüz kaydettiğiniz bir yazı yok. Yazı sayfalarındaki “Kaydet” düğmesini kullanın.</EmptyState>
            </div>
          ) : (
            articles.map((article) => (
              <div key={article.articleId} className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <ArticleCard
                    title={article.title}
                    slug={article.slug}
                    summary={article.summary}
                    publishedAt={article.publishedAt}
                  />
                </div>
                <div className="pt-5">
                  <ActionButton
                    action={removeBookmarkAction}
                    csrfToken={csrfToken}
                    label="Çıkar"
                    variant="ghost"
                    fields={{ articleId: article.articleId, slug: article.slug }}
                  />
                </div>
              </div>
            ))
          )}
        </Card>

        <Card>
          <h2 className="font-serif text-lg">Gönderiler</h2>
          <PostList posts={posts} csrfToken={csrfToken} empty="Henüz kaydettiğiniz bir gönderi yok." />
        </Card>
      </div>
    </>
  );
}
