import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { getPublishedIssue } from "@/services/public";
import { readIssuePages } from "@/services/issue-pages";
import { ArticleCard } from "@/components/magazine";
import { SiteBanner } from "@/components/site-ui";
import { EmptyState } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { templateOf } from "@/lib/issue-templates";
import { formatIssueNumber } from "@/lib/site";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayı" };

/**
 * One issue's own page: what it is, what is in it, and the way in (D-234).
 *
 * A published issue is open to any signed-in reader. One that is still being
 * put together is visible only to the editorial panel, and says so plainly —
 * `readIssuePages` is what decides, so an unpublished issue answers 404 to
 * everybody else rather than merely hiding its link.
 */
export default async function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  const { user } = await requireSession();
  const { number } = await params;

  const parsed = Number(number);
  if (!Number.isInteger(parsed) || parsed < 1) notFound();

  const reader = await readIssuePages({ ...user }, parsed).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  // The published issue keeps its own contents list of articles; a draft has
  // only the pages that have been laid out so far
  const published = await (reader.preview ? Promise.resolve(null) : getPublishedIssue(parsed));

  const subtitle = [
    `Sayı ${formatIssueNumber(reader.issue.number)}`,
    reader.issue.theme,
    reader.issue.publishedAt && formatDate(reader.issue.publishedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  const contents = reader.pages.filter((page) => page.inContents);

  return (
    <>
      <SiteBanner title={reader.issue.title} subtitle={subtitle} />

      {reader.preview && (
        <section className="issues-section">
          <p className="issue-preview-note">
            Bu sayı hazırlanıyor; yalnızca dergi ekibine görünür. Yayımlanmadan okurlara açılmaz.
          </p>
        </section>
      )}

      <section className="issues-section" aria-labelledby="issue-open-title">
        <div className="site-section-head">
          <h2 id="issue-open-title" className="site-caps-title fit-line">
            {reader.issue.theme ?? "Bu sayı"}
          </h2>
          <Link href="/magazine/issues" className="site-more">
            Tüm sayılar <ArrowRight aria-hidden />
          </Link>
        </div>

        <p className="issue-blurb">
          {reader.issue.blurb ?? (
            <span className="issue-blurb-empty">[Sayı tanıtımı — panelden doldurulacak]</span>
          )}
        </p>

        {reader.pages.length > 0 ? (
          <Link href={`/magazine/issues/${reader.issue.number}/oku`} className="site-outline-button">
            <BookOpen aria-hidden /> {reader.preview ? "Dergiyi önizle" : "Dergiyi oku"}
          </Link>
        ) : (
          <p className="issue-blurb-empty">Bu sayının sayfaları henüz hazırlanmadı.</p>
        )}
      </section>

      {contents.length > 0 && (
        <section className="issues-section" aria-labelledby="pages-title">
          <div className="site-section-head">
            <h2 id="pages-title" className="site-caps-title fit-line">
              İçindekiler
            </h2>
          </div>
          <ol className="issue-page-list">
            {contents.map((page) => (
              <li key={page.id}>
                <Link href={`/magazine/issues/${reader.issue.number}/oku?s=${page.id}`}>
                  <span>
                    {page.tocTitle ??
                      page.heading ??
                      page.article?.title ??
                      templateOf(page.template).label}
                  </span>
                  <span className="issue-page-number">{page.position}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {published && (
        <section className="issues-section" aria-labelledby="contents-title">
          <div className="site-section-head">
            <h2 id="contents-title" className="site-caps-title fit-line">
              Bu sayıdaki yazılar
            </h2>
          </div>

          {published.articles.length === 0 ? (
            <EmptyState>Bu sayıda henüz yayınlanmış yazı yok.</EmptyState>
          ) : (
            <div className="issue-contents">
              {published.articles.map((article) => (
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
      )}
    </>
  );
}
