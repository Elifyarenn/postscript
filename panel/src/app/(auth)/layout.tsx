import { NO_INDEX } from "@/lib/seo";
import Link from "next/link";
import type { ReactNode } from "react";

// Sign-in, panel and member pages stay out of search (D-252)
export const metadata = { robots: NO_INDEX };

/** Centred single-column shell for the screens you can reach without a session. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center">
          <span className="font-serif text-3xl tracking-tight text-ink">postscript</span>
          <span className="mt-1 block text-xs tracking-[0.3em] text-muted uppercase">
            e-dergi
          </span>
        </Link>

        {/* The screen reader landmark the form lives in (D-253) */}
        <main>{children}</main>

        <p className="mt-8 text-center text-xs text-muted">
          <span>
            Designed by{" "}
            <a
            href="https://www.elifyarencekic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
              Elif Yaren Çekiç
            </a>{" "}
            &amp; Tuanna Demir
          </span>
        </p>
      </div>
    </div>
  );
}
