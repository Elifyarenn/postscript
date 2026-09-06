import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { kvkkVersions } from "@/db/schema";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "KVKK Aydınlatma Metni" };

// Reads the current notice from the database, so it is rendered per request
export const dynamic = "force-dynamic";

/**
 * The notice the registration form links to. Versions are kept, and the current
 * one is whichever row carries `is_current` (§11).
 */
export default async function KvkkPage() {
  const rows = await db
    .select()
    .from(kvkkVersions)
    .where(and(eq(kvkkVersions.isCurrent, true)))
    .orderBy(desc(kvkkVersions.version))
    .limit(1);

  const current = rows[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/register" className="text-sm text-muted hover:text-ink">
        ← Kayıt sayfasına dön
      </Link>

      {current ? (
        <>
          <h1 className="mt-6 font-serif text-2xl">{current.title}</h1>
          <p className="mt-1 text-xs text-muted">
            Sürüm {current.version} · {formatDate(current.publishedAt)} · sha256:{" "}
            <code className="break-all">{current.bodyHash}</code>
          </p>

          <div
            className="prose-panel mt-8 text-sm"
            dangerouslySetInnerHTML={{ __html: await renderMarkdown(current.bodyMarkdown) }}
          />
        </>
      ) : (
        <>
          <h1 className="mt-6 font-serif text-2xl">KVKK Aydınlatma Metni</h1>
          <p className="mt-4 text-sm text-muted">
            Aydınlatma metni henüz yayınlanmadı. Yöneticiler bu metni yönetim panelindeki
            &ldquo;Sistem&rdquo; sayfasından yayınlar.
          </p>
        </>
      )}

      <p className="mt-12 text-center text-xs text-muted">
        <a
          href="https://www.elifyarencekic.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          Designed by Elif Yaren Çekiç & Tuanna Demir
        </a>
      </p>
    </main>
  );
}
