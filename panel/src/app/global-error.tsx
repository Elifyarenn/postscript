"use client";

import "./globals.css";

/**
 * Replaces the root layout when the layout itself fails (D-253), so it brings
 * its own html and body. A plain link rather than next/link: the app shell
 * may be what broke.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-2xl">Bir şeyler ters gitti</h1>
            <p className="mt-3 text-sm text-muted">Site şu anda yüklenemedi. Birazdan tekrar deneyin.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => retry()}
                className="rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-paper"
              >
                Tekrar dene
              </button>
              <a href="/" className="rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-paper">
                Ana sayfaya dön
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
