import type { Metadata } from "next";
import Link from "next/link";
import { guardManorGame } from "@/lib/auth/guard";
import { bodyFont, capsFont, italicFont } from "@/lib/fonts";
import { NO_INDEX } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { manorCover } from "@/services/manor-game";
import { ManorGame } from "@/components/manor-game";
import { Wordmark } from "@/components/site-ui";

// A closed preview (D-263): out of search, out of the sitemap and not linked
// from anywhere. noindex only keeps it out of results; the guard is the lock.
export const metadata: Metadata = {
  title: "Lanetli Malikâneden Çıkabilecek Misin?",
  robots: NO_INDEX,
};

/**
 * The game's own dark frame (D-263), holding one magazine page that never
 * scrolls (D-266). The wordmark, the faces and the burgundy are the
 * magazine's, so it still reads as PostScript.
 */
export default async function ManorGamePage() {
  await guardManorGame();

  return (
    <div className={cn("manor", bodyFont.variable, capsFont.variable, italicFont.variable)}>
      <a href="#manor-main" className="manor-skip">
        Oyuna geç
      </a>
      <header className="manor-bar">
        <Link href="/" className="manor-brand" aria-label="PostScript Dergi ana sayfa">
          <Wordmark />
        </Link>
        <p className="manor-badge">Kapalı önizleme</p>
      </header>

      <main id="manor-main" tabIndex={-1} className="manor-main">
        <ManorGame cover={manorCover()} />
      </main>

      <footer className="manor-foot">
        <p>PostScript Dergi · Eğlence &amp; Dedikodu</p>
        <p>
          Designed by{" "}
          <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">
            Elif Yaren Çekiç
          </a>{" "}
          &amp; Tuanna Demir
        </p>
      </footer>
    </div>
  );
}
