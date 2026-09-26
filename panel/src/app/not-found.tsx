import Link from "next/link";

/**
 * Every `notFound()` and unknown address lands here (D-253), in Turkish and
 * with a way back, instead of Next's bare English page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm tracking-widest text-muted">404</p>
        <h1 className="mt-2 font-serif text-2xl">Sayfa bulunamadı</h1>
        <p className="mt-3 text-sm text-muted">
          Aradığınız sayfa taşınmış, kaldırılmış ya da hiç var olmamış olabilir.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-paper"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
