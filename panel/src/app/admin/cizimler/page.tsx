import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { cn } from "@/lib/utils";
import { listIllustrationsForReview } from "@/services/illustrations";
import { listAllWriterAreasWithQuota } from "@/services/writer-areas";
import { ActionButton, PanelForm } from "@/components/form";
import { IllustrationCard } from "@/components/illustrations";
import { Alert, Card, EmptyState, PageHeader, Select } from "@/components/ui";
import { removeIllustrationAction } from "@/app/cizer/actions";
import { setIllustrationAreaAction } from "@/app/admin/actions";

export const metadata = { title: "Çizimler" };

/** The filter value for drawings not filed under any category yet. */
const NO_AREA = "yok";

/**
 * The drawings çizers sent (D-362), for the admins only (D-372). Grouped by
 * çizer, newest first; an admin files each under a category by its id (D-381).
 * Their licence forms are prepared on /admin/agreements.
 */
export default async function AdminIllustrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const [all, areas, params] = await Promise.all([
    listIllustrationsForReview({ ...user }),
    listAllWriterAreasWithQuota(),
    searchParams,
  ]);

  const counts = new Map<string, number>();
  for (const item of all) counts.set(item.areaId ?? NO_AREA, (counts.get(item.areaId ?? NO_AREA) ?? 0) + 1);

  // An unknown value shows everything rather than an empty page
  const filter = params.kategori === NO_AREA || areas.some((area) => area.id === params.kategori) ? params.kategori : null;
  const items = filter ? all.filter((item) => (item.areaId ?? NO_AREA) === filter) : all;

  const groups = new Map<string, { name: string; items: typeof items }>();
  for (const item of items) {
    const group = groups.get(item.illustratorId) ?? { name: item.illustratorName, items: [] };
    group.items.push(item);
    groups.set(item.illustratorId, group);
  }

  const tabs = [
    { key: null, label: "Tümü", count: all.length },
    ...areas.map((area) => ({ key: area.id, label: area.name, count: counts.get(area.id) ?? 0 })),
    { key: NO_AREA, label: "Kategorisiz", count: counts.get(NO_AREA) ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title="Çizimler"
        description="Çizerlerin kendi panelinden adlandırıp gönderdiği çizimler. Yalnızca adminler görür; kategoriyi burada siz seçersiniz."
      />

      <div className="mb-6">
        <Alert tone="info" title="Ruhsat formu (çizim)">
          Gönderim yayın izni değildir. Bir çizerin bir sayıya gönderdiği çizimler için tek bir ruhsat formu
          hazırlanır: <Link href="/admin/agreements" className="underline">Sözleşme sürümleri</Link> →
          &quot;Bir sayının ruhsat formlarını hazırla&quot; (sayı ve isteğe bağlı olarak çizer seçin). Form
          hazırlanınca çizere e-postayla gönderilir ve imzalı kopyası yazarlardaki gibi yüklenir. Kategori forma
          yazılmaz; değiştirmek hazırlanmış formu bozmaz.
        </Alert>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Kategoriler">
        {tabs.map((tab) => (
          <Link
            key={tab.key ?? "tumu"}
            href={tab.key ? `/admin/cizimler?kategori=${tab.key}` : "/admin/cizimler"}
            aria-current={tab.key === filter ? "page" : undefined}
            className={cn(
              "rounded-md border border-line px-2.5 py-1",
              tab.key === filter ? "bg-ink text-paper" : "hover:bg-paper",
            )}
          >
            {tab.label} ({tab.count})
          </Link>
        ))}
      </nav>

      {groups.size === 0 ? (
        <Card>
          <EmptyState>{filter ? "Bu kategoride çizim yok." : "Henüz gönderilmiş çizim yok."}</EmptyState>
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
                    <div className="w-full">
                      <PanelForm
                        action={setIllustrationAreaAction}
                        csrfToken={csrfToken}
                        submitLabel="Kategoriyi kaydet"
                        submitVariant="secondary"
                      >
                        <input type="hidden" name="illustrationId" value={item.id} />
                        <Select name="areaId" defaultValue={item.areaId ?? ""} aria-label={`"${item.title}" kategorisi`}>
                          <option value="">Kategorisiz</option>
                          {areas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                              {area.isActive ? "" : " (kapalı)"}
                            </option>
                          ))}
                        </Select>
                      </PanelForm>
                    </div>
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
