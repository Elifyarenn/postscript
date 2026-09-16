/**
 * The ornaments of the magazine frame (D-112): the wordmark, the eight-ray
 * star, the pair of solid stars and the page titles built from them.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import wordmark from "@/assets/design/wordmark.png";
import type { SocialKey } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The "POSTSCRIPT†" wordmark. Its face is a commercial one, so it ships as an
 * alpha mask and CSS paints it with `currentColor`: one file serves the ink
 * header and the paper footer.
 */
export function Wordmark({ className }: { className?: string }) {
  const mask = `url(${wordmark.src})`;
  return (
    <span
      role="img"
      aria-label="POSTSCRIPT"
      className={cn("site-wordmark", className)}
      style={{
        WebkitMaskImage: mask,
        maskImage: mask,
        aspectRatio: `${wordmark.width} / ${wordmark.height}`,
      }}
    />
  );
}

/** Eight rays, long on the axes and short between, as drawn in the designs. */
const SPARKLE_PATH = (() => {
  const points: string[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const radius = i % 4 === 0 ? 12 : i % 2 === 0 ? 5 : 1.4;
    points.push(`${(12 + radius * Math.cos(angle)).toFixed(2)} ${(12 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
})();

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("site-sparkle", className)}>
      <path d={SPARKLE_PATH} fill="currentColor" />
    </svg>
  );
}

const STAR_PATH =
  "M12 1.5l3.09 6.6 7.16.86-5.28 4.94 1.4 7.1L12 17.4 5.63 21l1.4-7.1L1.75 8.96l7.16-.86z";

/** The two solid stars of the top strip and the footer. */
export function Stars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 24" aria-hidden className={cn("site-stars", className)}>
      <path d={STAR_PATH} fill="currentColor" />
      <path d={STAR_PATH} fill="currentColor" transform="translate(25 0)" />
    </svg>
  );
}

const SOCIAL_PATHS: Record<SocialKey, string> = {
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.07h1.833L7.084 4.126H5.117z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  pinterest:
    "M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z",
};

/** The footer's round social icons, drawn from the old front page's marks. */
export function SocialIcon({ name }: { name: SocialKey }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={SOCIAL_PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/** The curved arrow under each category card. */
export function Swoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 28" aria-hidden className={className}>
      <path d="M3 19c11-10 22 4 37-5" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M37 5l21 8-19 11" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A page's display title with its star, as on the community designs. */
export function SiteTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <header className="site-title-block">
      <h1 className="site-title fit-line">
        {children}
        <Sparkle className="site-title-star" />
      </h1>
      {description && <p className="site-title-description">{description}</p>}
    </header>
  );
}

/** The night-burgundy banner with a hairline italic title ("HAKKINDA", "SAYILAR"). */
export function SiteBanner({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Replaces the star on the right, e.g. with a quotation. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="site-banner">
      <div>
        <h1 className="site-banner-title fit-line">{title}</h1>
        {subtitle && <p className="site-banner-subtitle">{subtitle}</p>}
        {children}
      </div>
      <div className="site-banner-aside">
        <Sparkle className="site-banner-star" />
        {aside}
      </div>
    </section>
  );
}

/**
 * The pages the strip lists: a window around the current page, the first and
 * the last always there, gaps marked with an ellipsis (null).
 */
function pagerPages(page: number, pageCount: number): (number | null)[] {
  const shown = new Set<number>([1, pageCount]);
  for (let value = page - 1; value <= page + 1; value += 1) {
    if (value >= 1 && value <= pageCount) shown.add(value);
  }
  // The design opens with "1 2 3 4 5 … 10", so the near end stays whole
  const run = (from: number) => {
    for (let value = from; value < from + 5 && value <= pageCount; value += 1) {
      if (value >= 1) shown.add(value);
    }
  };
  if (page <= 3) run(1);
  if (page > pageCount - 3) run(pageCount - 4);

  const pages: (number | null)[] = [];
  let previous = 0;
  for (const value of [...shown].sort((a, b) => a - b)) {
    if (previous > 0 && value - previous > 1) pages.push(null);
    pages.push(value);
    previous = value;
  }
  return pages;
}

/**
 * The strip of page numbers the designs draw under a list (D-150). It is plain
 * links, so it works before JavaScript and each page has its own address.
 */
export function Pager({
  page,
  pageCount,
  href,
  label = "Sayfalar",
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  label?: string;
}) {
  if (pageCount < 2) return null;

  return (
    <nav className="site-pager" aria-label={label}>
      {page > 1 ? (
        <Link href={href(page - 1)} className="site-pager-cell" aria-label="Önceki sayfa">
          ←
        </Link>
      ) : (
        <span className="site-pager-cell is-off" aria-hidden>
          ←
        </span>
      )}

      {pagerPages(page, pageCount).map((value, index) =>
        value === null ? (
          <span key={`gap-${index}`} className="site-pager-cell is-gap" aria-hidden>
            …
          </span>
        ) : value === page ? (
          <span key={value} className="site-pager-cell is-current" aria-current="page">
            {value}
          </span>
        ) : (
          <Link key={value} href={href(value)} className="site-pager-cell" aria-label={`Sayfa ${value}`}>
            {value}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link href={href(page + 1)} className="site-pager-cell" aria-label="Sonraki sayfa">
          →
        </Link>
      ) : (
        <span className="site-pager-cell is-off" aria-hidden>
          →
        </span>
      )}
    </nav>
  );
}
