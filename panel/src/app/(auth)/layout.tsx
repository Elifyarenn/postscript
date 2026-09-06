import Link from "next/link";
import type { ReactNode } from "react";

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

        {children}

        <p className="mt-8 text-center text-xs text-muted">
          <a
            href="https://www.elifyarencekic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            Designed by Elif Yaren Çekiç & Tuanna Demir
          </a>
        </p>
      </div>
    </div>
  );
}
