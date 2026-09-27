import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { guardManorGame } from "@/lib/auth/guard";
import { NO_INDEX } from "@/lib/seo";
import { formatIssueNumber } from "@/lib/site";
import { manorCover } from "@/services/manor-game";
import { ManorGame } from "@/components/manor-game";

// A closed preview (D-263): out of search, out of the sitemap and not linked
// from anywhere. noindex only keeps it out of results; the guard is the lock.
export const metadata: Metadata = {
  title: "Lanetli Malikâneden Çıkabilecek Misin?",
  robots: NO_INDEX,
};

/**
 * The game belongs to the Gotizm issue's Eğlence & Dedikodu section (D-265).
 * Until that issue is laid out in the panel there is no issue record to read
 * this from, so the preview names it here; the page it will sit on has no
 * number yet, so the folio shows none.
 */
const PREVIEW_ISSUE = { number: 2, theme: "Gotizm" } as const;

/**
 * The preview inside the magazine's own reader (D-265): the same bare frame
 * as `/magazine/issues/[n]/oku` (this route sits in the reader's route group),
 * the same top strip and the same stage, holding one page. The reader's page
 * turning, contents and zoom are left out — there is nothing here to turn to
 * — and so is anything that would pretend there were.
 */
export default async function ManorGamePage() {
  await guardManorGame();

  return (
    <div className="reader">
      <header className="reader-bar">
        <div className="reader-bar-side">
          <Link href="/" className="reader-icon" title="Ana sayfaya dön" aria-label="Ana sayfaya dön">
            <X aria-hidden />
          </Link>
        </div>

        <p className="reader-title">
          <span className="reader-issue">Sayı {formatIssueNumber(PREVIEW_ISSUE.number)}</span>
          <span className="reader-name">{PREVIEW_ISSUE.theme}</span>
          <span className="reader-flag">
            Kapalı önizleme
            <span className="reader-flag-more"> · yayımlanmadı</span>
          </span>
        </p>

        <div className="reader-bar-side reader-bar-end" />
      </header>

      <main className="reader-stage manor-stage">
        <div className="reader-pages" style={{ "--pages": 1 } as React.CSSProperties}>
          <ManorGame cover={manorCover()} issue={PREVIEW_ISSUE} folio={null} />
        </div>
      </main>
    </div>
  );
}
