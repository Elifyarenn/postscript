import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { listIllustrationsForReview } from "@/services/illustrations";
import { ActionButton } from "@/components/form";
import { IllustrationCard } from "@/components/illustrations";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { removeIllustrationAction } from "@/app/cizer/actions";

export const metadata = { title: "Çizimler" };

/**
 * The drawings çizers sent (D-362), for the admins only (D-372). Grouped by
 * çizer, newest first. Their licence forms are prepared on /admin/agreements.
 */
export default async function AdminIllustrationsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const items = await listIllustrationsForReview({ ...user });

  const groups = new Map<string, { name: string; items: typeof items }>();
  for (const item of items) {
    const group = groups.get(item.illustratorId) ?? { name: item.illustratorName, items: [] };
    group.items.push(item);
    groups.set(item.illustratorId, group);
  }

  return (
    <>
      <PageHeader
        title="Çizimler"
        description="Çizerlerin kendi panelinden adlandırıp gönderdiği çizimler. Yalnızca adminler görür."
      />

      <div className="mb-6">
        <Alert tone="info" title="Ruhsat formu (çizim)">
          Gönderim yayın izni değildir. Bir çizerin bir sayıya gönderdiği çizimler için tek bir ruhsat formu
          hazırlanır: <Link href="/admin/agreements" className="underline">Sözleşme sürümleri</Link> →
          &quot;Bir sayının ruhsat formlarını hazırla&quot; (sayı ve isteğe bağlı olarak çizer seçin). Form
          hazırlanınca çizere e-postayla gönderilir ve imzalı kopyası yazarlardaki gibi yüklenir.
        </Alert>
      </div>

      {groups.size === 0 ? (
        <Card>
          <EmptyState>Henüz gönderilmiş çizim yok.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([illustratorId, group]) => (
            <Card key={illustratorId}>
              <h2 className="mb-4 font-serif text-lg">
                {group.name} <span className="text-sm text-muted">· {group.items.length} çizim</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <IllustrationCard key={item.id} item={item}>
                    <ActionButton
                      action={removeIllustrationAction}
                      csrfToken={csrfToken}
                      label="Kaldır"
                      variant="danger"
                      fields={{ illustrationId: item.id }}
                      confirmMessage={`"${item.title}" kaldırılsın mı? Dosya silinir, çizer de göremez; gönderilmemiş ruhsat formu da silinir. Geri alınamaz.`}
                    />
                  </IllustrationCard>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
