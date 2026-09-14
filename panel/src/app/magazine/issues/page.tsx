import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { listPublishedIssues } from "@/services/public";
import { SiteBanner, Sparkle } from "@/components/site-ui";
import { EmptyState } from "@/components/ui";
import { formatIssueNumber } from "@/lib/site";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayılar" };

/**
 * Every published issue, newest first, as the "magazines" design (D-114).
 * Covers are a solid block with the issue number: the design leaves them
 * empty too, and no cover is uploaded yet.
 */
export default async function IssuesPage() {
  await requireSession();
  const issues = await listPublishedIssues();

  return (
    <>
      <SiteBanner
        title="Sayılar"
        subtitle="Yazılar, öyküler, söyleşiler ve dahası…"
        aside={<p className="banner-quote">&ldquo;Daha tuhaf bir dünya için daha iyi hikâyeler.&rdquo;</p>}
      >
        <a href="#one-cikan-sayilar" className="site-outline-button banner-button">
          Tüm sayıları keşfet!
        </a>
      </SiteBanner>

      <section id="one-cikan-sayilar" className="issues-section" aria-labelledby="issues-title">
        <div className="issues-head">
          <h2 id="issues-title" className="site-caps-title">
            Öne çıkan sayılar
          </h2>
          <span className="issues-rule" aria-hidden>
            <Sparkle />
          </span>
          <Link href="/magazine" className="site-more">
            Son yazılar <ArrowRight aria-hidden />
          </Link>
        </div>

        {issues.length === 0 ? (
          <EmptyState>Yayınlanmış sayı yok. İlk sayı yolda.</EmptyState>
        ) : (
          <ul className="issue-grid">
            {issues.map((issue, index) => (
              <li key={issue.number} className="issue-card">
                <Link href={`/magazine/issues/${issue.number}`} className="issue-cover" aria-hidden tabIndex={-1}>
                  <span>{formatIssueNumber(issue.number)}</span>
                </Link>
                <div className="issue-text">
                  {index === 0 && <p className="issue-new">Yeni!</p>}
                  <h3 className="issue-title">
                    <Link href={`/magazine/issues/${issue.number}`}>
                      Postscript: <span>{issue.title}</span>
                    </Link>
                  </h3>
                  {issue.theme && <p className="issue-theme">{issue.theme}</p>}
                  <p className="issue-date">
                    Sayı {formatIssueNumber(issue.number)}
                    {issue.publishedAt && <> · {formatDate(issue.publishedAt)}</>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
