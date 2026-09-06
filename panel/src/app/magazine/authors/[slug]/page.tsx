import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getPublicAuthor } from "@/services/public";
import { ArticleCard, AuthorLinks } from "@/components/magazine";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { isAppError } from "@/lib/errors";

export const metadata = { title: "Yazar" };

/** An author's page: the pen name, the biography and everything published. */
export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireSession();
  const { slug } = await params;

  const author = await getPublicAuthor(slug).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  return (
    <>
      <PageHeader title={author.name} description={author.bio ?? undefined} />

      <AuthorLinks links={author.socialLinks} />

      <Card className="mt-6">
        <h2 className="font-serif text-lg">Yazıları</h2>
        <div className="mt-2">
          {author.articles.length === 0 ? (
            <EmptyState>Bu yazarın yayınlanmış yazısı yok.</EmptyState>
          ) : (
            author.articles.map((article) => (
              <ArticleCard
                key={article.slug}
                title={article.title}
                slug={article.slug}
                issueNumber={article.issueNumber}
                publishedAt={article.publishedAt}
              />
            ))
          )}
        </div>
      </Card>
    </>
  );
}
