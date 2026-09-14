/**
 * The ornaments of the magazine frame (D-112): the wordmark, the eight-ray
 * star, the pair of solid stars and the page titles built from them.
 */
import type { ReactNode } from "react";
import wordmark from "@/assets/design/wordmark.png";
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
      <h1 className="site-title">
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
        <h1 className="site-banner-title">{title}</h1>
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
