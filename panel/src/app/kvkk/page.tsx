import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { kvkkVersions } from "@/db/schema";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/utils";
import { LegalPage } from "@/components/legal";

export const metadata = { title: "KVKK Aydınlatma Metni" };

// Reads the current notice from the database, so it is rendered per request
export const dynamic = "force-dynamic";

/**
 * The notice the registration form links to. Versions are kept, and the current
 * one is whichever row carries `is_current` (§11).
 *
 * The registration link opens this page in a new tab, so it needs no way back;
 * the shared footer nav carries the other two statutory pages (D-084).
 */
export default async function KvkkPage() {
  const rows = await db
    .select()
    .from(kvkkVersions)
    .where(and(eq(kvkkVersions.isCurrent, true)))
    .orderBy(desc(kvkkVersions.version))
    .limit(1);

  const current = rows[0];

  if (!current) {
    return (
      <LegalPage title="KVKK Aydınlatma Metni" current="/kvkk">
        <p>
          Aydınlatma metni henüz yayınlanmadı. Yöneticiler bu metni yönetim panelindeki
          &ldquo;Sistem&rdquo; sayfasından yayınlar.
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage
      title={current.title}
      current="/kvkk"
      subtitle={
        <>
          Sürüm {current.version} · {formatDate(current.publishedAt)} · sha256:{" "}
          <code className="break-all">{current.bodyHash}</code>
        </>
      }
    >
      <div dangerouslySetInnerHTML={{ __html: await renderMarkdown(current.bodyMarkdown) }} />
    </LegalPage>
  );
}
