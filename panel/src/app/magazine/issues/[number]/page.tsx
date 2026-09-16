import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { getPublishedIssue } from "@/services/public";
import { ArticleCard } from "@/components/magazine";
import { SiteBanner } from "@/components/site-ui";
import { EmptyState } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { formatIssueNumber } from "@/lib/site";
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

  const subtitle = [`Sayı ${formatIssueNumber(issue.number)}`, issue.theme, issue.publishedAt && formatDate(issue.publishedAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <SiteBanner title={issue.title} subtitle={subtitle} />

      <section className="issues-section" aria-labelledby="contents-title">
        <div className="site-section-head">
          <h2 id="contents-title" className="site-caps-title fit-line">
            İçindekiler
          </h2>
          <Link href="/magazine/issues" className="site-more">
            Tüm sayılar <ArrowRight aria-hidden />
          </Link>
        </div>

        {issue.articles.length === 0 ? (
          <EmptyState>Bu sayıda henüz yayınlanmış yazı yok.</EmptyState>
        ) : (
          <div className="issue-contents">
            {issue.articles.map((article) => (
              <ArticleCard
                key={article.slug}
                title={article.title}
                slug={article.slug}
                summary={article.summary}
                author={article.author}
                authorSlug={article.authorSlug}
                publishedAt={article.publishedAt}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
