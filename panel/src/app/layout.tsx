import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import "./globals.css";

// Only the production site is indexed; dev and test builds stay out of search.
// NODE_ENV is constant per build, so this cannot flip at runtime.
const devRobots = process.env.NODE_ENV === "production" ? {} : { robots: { index: false, follow: false } };

export const metadata: Metadata = {
  // Resolves the relative canonical and share image URLs the pages set (D-252)
  metadataBase: new URL(env().SITE_URL),
  title: {
    default: SITE_NAME,
    template: `${SITE_NAME} - %s`,
  },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", locale: "tr_TR", siteName: SITE_NAME },
  icons: {
    icon: "/favicon.ico",
  },
  ...devRobots,
};

/**
 * One theme only (D-191). "only light" tells a browser that follows the phone's
 * dark mode not to darken the site on its own: the burgundy and paper palette is
 * the design, and an automatic inversion breaks its contrast.
 */
export const viewport: Viewport = {
  colorScheme: "only light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
