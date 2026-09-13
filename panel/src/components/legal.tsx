import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shell the three statutory pages share (D-084).
 *
 * 5651 s. 3 wants the publisher details reachable from the front page, and a
 * reader who lands on one of these pages is usually looking for one of the
 * others, so each one carries the full set of links. They are public: no
 * session is required to read them.
 */

const LEGAL_LINKS = [
  { href: "/iletisim", label: "Künye ve iletişim" },
  { href: "/kullanim-sartlari", label: "Kullanım şartları" },
  { href: "/kvkk", label: "KVKK aydınlatma metni" },
] as const;

export function LegalPage({
  title,
  subtitle,
  current,
  back,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** The page's own href, so its link is shown as plain text rather than a loop. */
  current: string;
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {back ? (
        <Link href={back.href} className="text-sm text-muted hover:text-ink">
          ← {back.label}
        </Link>
      ) : null}

      <h1 className={`font-serif text-2xl ${back ? "mt-6" : ""}`}>{title}</h1>
      {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}

      <div className="prose-panel mt-8 text-sm">{children}</div>

      <nav
        className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-line pt-6 text-xs text-muted"
        aria-label="Yasal sayfalar"
      >
        {LEGAL_LINKS.map((link) =>
          link.href === current ? (
            <span key={link.href}>{link.label}</span>
          ) : (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ),
        )}
      </nav>

      <p className="mt-6 text-center text-xs text-muted">
        <a
          href="https://www.elifyarencekic.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          Designed by Elif Yaren Çekiç &amp; Tuanna Demir
        </a>
      </p>
    </main>
  );
}
