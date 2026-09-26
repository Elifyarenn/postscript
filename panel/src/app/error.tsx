"use client";

import Link from "next/link";

/**
 * Shown when a page fails to render, for example when the database does not
 * answer (D-253). Keeps the root layout, so the page stays Turkish; the error
 * itself is logged on the server and never shown to the visitor.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl">Bir şeyler ters gitti</h1>
        <p className="mt-3 text-sm text-muted">
          Sayfa şu anda yüklenemedi. Birazdan tekrar deneyebilir ya da ana sayfaya dönebilirsiniz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-paper"
          >
            Tekrar dene
          </button>
          <Link
            href="/"
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-paper"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    </main>
  );
}
