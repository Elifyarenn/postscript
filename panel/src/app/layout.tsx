import type { Metadata, Viewport } from "next";
import "./globals.css";

// Only the production site is indexed; dev and test builds stay out of search.
// NODE_ENV is constant per build, so this cannot flip at runtime.
const devRobots = process.env.NODE_ENV === "production" ? {} : { robots: { index: false, follow: false } };

export const metadata: Metadata = {
  title: {
    default: "PostScript Dergi",
    template: "PostScript Dergi - %s",
  },
  description: "PostScript Dergi — edebiyat, psikoloji ve kültür üzerine bir e-dergi.",
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
