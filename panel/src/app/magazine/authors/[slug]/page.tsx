import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAuthor } from "@/services/public";
import { ArticleCard, AuthorLinks } from "@/components/magazine";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { NO_INDEX, pageMetadata } from "@/lib/seo";

/** One query per request for the metadata and the page alike; null when there is no such page. */
const loadAuthor = cache((slug: string) =>
  getPublicAuthor(slug).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) return null;
    throw error;
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const author = await loadAuthor((await params).slug);
  if (!author) return { title: "Yazar", robots: NO_INDEX };

  return pageMetadata({
    title: author.name,
    description: author.bio ?? `${author.name}, PostScript Dergi yazarı: bütün yazıları.`,
    path: `/magazine/authors/${author.slug}`,
  });
}

/** An author's page: the pen name, the biography and everything published. Public (D-257). */
export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const author = await loadAuthor((await params).slug);
  if (!author) notFound();

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
