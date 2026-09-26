import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { cache } from "react";
import type { Metadata } from "next";
import { readerSession } from "@/lib/auth/guard";
import { getPublishedIssue } from "@/services/public";
import { readIssuePages } from "@/services/issue-pages";
import { ArticleCard } from "@/components/magazine";
import { SiteBanner } from "@/components/site-ui";
import { EmptyState } from "@/components/ui";
import { isAppError } from "@/lib/errors";
import { issueExtrasFor } from "@/lib/issue-extras";
import { templateOf } from "@/lib/issue-templates";
import { formatIssueNumber } from "@/lib/site";
import { formatDate } from "@/lib/utils";
import { NO_INDEX, pageMetadata } from "@/lib/seo";

/** One query per request for the metadata and the page alike. */
const publishedIssue = cache((number: number) => getPublishedIssue(number).catch(() => null));

function issueNumberOf(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 2_147_483_647 ? parsed : null;
}

/**
 * Titles and share cards come from the public read model only, so a draft or
 * the admins' working issue never lends its name to a search result (D-257).
 */
export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const number = issueNumberOf((await params).number);
  const issue = number === null ? null : await publishedIssue(number);
  if (!issue) return { title: "Sayı", robots: NO_INDEX };

  const label = `Sayı ${formatIssueNumber(issue.number)}`;
  return pageMetadata({
    title: `${label}: ${issue.title}`,
    description: [`PostScript Dergi ${label}: ${issue.title}`, issue.theme].filter(Boolean).join(" — ") + ".",
    path: `/magazine/issues/${issue.number}`,
  });
}

/**
 * One issue's own page: what it is, what is in it, and the way in (D-234).
 *
 * A published issue is open to everyone (D-257). One that is still being
 * put together is visible only to the editorial panel, and says so plainly —
 * `readIssuePages` is what decides, so an unpublished issue answers 404 to
 * everybody else rather than merely hiding its link.
 */
export default async function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  const context = await readerSession();
  const parsed = issueNumberOf((await params).number);
  if (parsed === null) notFound();

  const reader = await readIssuePages(context ? { ...context.user } : null, parsed).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  // The published issue keeps its own contents list of articles; a draft has
  // only the pages that have been laid out so far
  // (null too for the admins' working issue once it is marked published)
  const published = reader.preview ? null : await publishedIssue(parsed);

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
      <SiteBanner
        title={reader.issue.title}
        titleLang={issueExtrasFor(reader.issue.number)?.titleLang}
        subtitle={subtitle}
      />

      {reader.preview && (
        <section className="issues-section">
          <p className="issue-preview-note">
            {reader.issue.adminOnly
              ? "Bu bir örnek/geliştirme sayısıdır; yalnızca yönetici hesaplarına açıktır. Editörler, yazarlar ve üyeler göremez."
              : "Bu sayı hazırlanıyor; yalnızca dergi ekibine görünür. Yayımlanmadan okurlara açılmaz."}
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

        {/* The reminder is for the panel preview only; readers never see a placeholder (D-253) */}
        {reader.issue.blurb ? (
          <p className="issue-blurb">{reader.issue.blurb}</p>
        ) : reader.preview ? (
          <p className="issue-blurb">
            <span className="issue-blurb-empty">[Sayı tanıtımı — panelden doldurulacak]</span>
          </p>
        ) : null}

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
