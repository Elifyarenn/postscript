import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getPublishedIssue } from "@/services/public";
import { ArticleCard } from "@/components/magazine";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayı" };

/** The contents of one published issue, in the order the editor set. */
export default async function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  await requireSession();
  const { number } = await params;

  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();

  // An unpublished or missing issue is the same thing to a reader
  const issue = await getPublishedIssue(parsed).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  return (
    <>
      <PageHeader
        title={`Sayı ${issue.number} · ${issue.title}`}
        description={issue.theme ?? undefined}
      />

      {issue.publishedAt && (
        <p className="mb-4 text-xs text-muted">{formatDate(issue.publishedAt)}</p>
      )}

      <Card>
        <h2 className="font-serif text-lg">İçindekiler</h2>
        <div className="mt-2">
          {issue.articles.length === 0 ? (
            <EmptyState>Bu sayıda henüz yayınlanmış yazı yok.</EmptyState>
          ) : (
            issue.articles.map((article) => (
              <ArticleCard
                key={article.slug}
                title={article.title}
                slug={article.slug}
                summary={article.summary}
                author={article.author}
                authorSlug={article.authorSlug}
                publishedAt={article.publishedAt}
              />
            ))
          )}
        </div>
      </Card>
    </>
  );
}
