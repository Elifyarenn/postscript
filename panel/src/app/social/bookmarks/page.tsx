import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listBookmarkedArticles } from "@/services/social";
import { ActionButton } from "@/components/form";
import { ArticleCard } from "@/components/magazine";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { removeBookmarkAction } from "../actions";

export const metadata = { title: "Kaydedilenler" };

/** The private reading list; nobody else can see it. */
export default async function BookmarksPage() {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const saved = await listBookmarkedArticles({ ...user });

  return (
    <>
      <PageHeader title="Kaydedilenler" description="Kaydettiğiniz yazıları yalnızca siz görürsünüz." />

      {saved.length === 0 ? (
        <EmptyState>Henüz kaydettiğiniz bir yazı yok. Yazı sayfalarındaki “Kaydet” düğmesini kullanın.</EmptyState>
      ) : (
        <Card>
          {saved.map((article) => (
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
          ))}
        </Card>
      )}
    </>
  );
}
