import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import issuesBanner from "@/assets/design/banner-issues.webp";
import { requireSession } from "@/lib/auth/guard";
import { canAccessEditorPanel } from "@/lib/auth/rbac";
import { listPublishedIssues } from "@/services/public";
import { listIssues } from "@/services/issues";
import { SiteBanner, Sparkle } from "@/components/site-ui";
import { IssueCountdown } from "@/components/issue-countdown";
import { formatReleaseMoment } from "@/lib/countdown";
import { issueExtrasFor } from "@/lib/issue-extras";
import { formatIssueNumber } from "@/lib/site";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayılar" };

/** The issue the countdown is for (D-192). */
const UPCOMING_ISSUE = 1;

/** Empty cards drawn while nothing is published, so the page keeps the design's grid (D-116). */
const PLACEHOLDER_SLOTS = [1, 2, 3];

/**
 * Every published issue, newest first, as the "magazines" design (D-114,
 * D-148): the cover, the name, the issue's paragraph and its date, three
 * cards across. Covers are a solid block with the issue number: the design
 * leaves them empty too, and no cover is uploaded yet. Issues cannot be liked
 * yet, so the heart is drawn without a count (D-116).
 */
export default async function IssuesPage() {
  const { user } = await requireSession();
  const issues = await listPublishedIssues();

  // Issues still being put together are the team's business only; a reader
  // never sees them here and cannot reach them by guessing a number either,
  // because the issue's own pages refuse (D-234)
  const drafts = canAccessEditorPanel({ ...user })
    ? (await listIssues({ ...user })).filter((issue) => issue.status !== "published" && issue.status !== "archived")
    : [];
  // The countdown stays until the issue is published, then the issue's own card takes over
  const release = issues.some((issue) => issue.number === UPCOMING_ISSUE)
    ? null
    : (issueExtrasFor(UPCOMING_ISSUE)?.release ?? null);

  return (
    <>
      <SiteBanner
        title="Sayılar"
        subtitle="Yazılar, öyküler, söyleşiler ve dahası…"
        image={issuesBanner}
        aside={<p className="banner-quote">&ldquo;Daha tuhaf bir dünya için daha iyi hikâyeler.&rdquo;</p>}
      >
        <a href="#one-cikan-sayilar" className="site-outline-button banner-button">
          Tüm sayıları keşfet!
        </a>
      </SiteBanner>

      {release && (
        <IssueCountdown
          releaseAt={release.at}
          issueLabel={`Sayı ${formatIssueNumber(UPCOMING_ISSUE)}`}
          title={release.title}
          momentText={formatReleaseMoment(release.at)}
        />
      )}

      {drafts.length > 0 && (
        <section className="issues-section" aria-labelledby="drafts-title">
          <div className="site-section-head">
            <h2 id="drafts-title" className="site-caps-title fit-line">
              Hazırlanan sayılar
            </h2>
          </div>
          <p className="issue-blurb-empty">Yalnızca dergi ekibine görünür.</p>
          <div className="issue-drafts">
            {drafts.map((issue) => (
              <Link key={issue.id} href={`/magazine/issues/${issue.number}`} className="issue-draft">
                <p className="issue-draft-number">Sayı {formatIssueNumber(issue.number)}</p>
                <p className="issue-draft-title">{issue.theme ?? issue.title}</p>
                <p className="issue-draft-state">Hazırlanıyor</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="one-cikan-sayilar" className="issues-section" aria-labelledby="issues-title">
        <div className="issues-head">
          <h2 id="issues-title" className="site-caps-title fit-line">
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
          <>
            <p className="issues-empty">Yayınlanmış sayı yok. İlk sayı yolda.</p>
            <ul className="issue-grid" aria-hidden>
              {PLACEHOLDER_SLOTS.map((slot) => (
                <li key={slot} className="issue-card is-placeholder">
                  <span className="issue-cover">
                    <Sparkle />
                  </span>
                  <div className="issue-text">
                    <p className="issue-title">
                      POSTSCRIPT: <span className="fit-line">Çok yakında</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
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
                      POSTSCRIPT: <span className="fit-line">{issue.title}</span>
                    </Link>
                  </h3>
                  {issue.blurb ? (
                    <p className="issue-blurb">{issue.blurb}</p>
                  ) : (
                    issue.theme && <p className="issue-theme">{issue.theme}</p>
                  )}
                  {/* The design prints the date alone; the cover already carries the number */}
                  <p className="issue-date">
                    {issue.publishedAt
                      ? formatDate(issue.publishedAt)
                      : `Sayı ${formatIssueNumber(issue.number)}`}
                  </p>
                  <p className="issue-likes" title="Sayı beğenme yakında">
                    <Heart aria-hidden className="size-4" />
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
