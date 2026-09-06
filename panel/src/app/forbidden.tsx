import Link from "next/link";

/**
 * Rendered with HTTP 403 whenever `forbidden()` is called from a layout or
 * page. It says what happened without revealing what exists behind the door.
 */
export default function Forbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-sm tracking-widest text-muted">403</p>
        <h1 className="mt-2 font-serif text-2xl">Bu sayfaya erişim yetkiniz yok</h1>
        <p className="mt-3 text-sm text-muted">
          Hesabınızın rolü bu bölümü görmeye yetmiyor. Yetki gerekiyorsa bir yöneticiye başvurun.
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
