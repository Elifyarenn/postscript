import { notFound } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { canAccessAdminPanel } from "@/lib/auth/rbac";
import { readCsrfToken } from "@/lib/csrf";
import { listIllustrationsForReview, mayReviewIllustrations } from "@/services/illustrations";
import { ActionButton } from "@/components/form";
import { IllustrationCard } from "@/components/illustrations";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { removeIllustrationAction } from "@/app/cizer/actions";

export const metadata = { title: "Çizimler" };

/**
 * The drawings çizers handed in (D-362), for the admins and the main editor;
 * a category editor gets a 404. Grouped by çizer, newest first.
 */
export default async function EditorIllustrationsPage() {
  const { user } = await guardPanel("editor");
  if (!(await mayReviewIllustrations({ ...user }))) notFound();
  const csrfToken = (await readCsrfToken()) ?? "";
  const items = await listIllustrationsForReview({ ...user });
  // Taking a drawing down is the admins' removal path; the main editor looks and downloads
  const removes = canAccessAdminPanel({ ...user });

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
        description="Çizerlerin kendi panelinden yüklediği çizimler. Yükleme yayın izni değildir; dergide kullanılacak çizim için ruhsat formu hazırlanır."
      />

      {groups.size === 0 ? (
        <Card>
          <EmptyState>Henüz yüklenmiş çizim yok.</EmptyState>
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
                    {removes && (
                      <ActionButton
                        action={removeIllustrationAction}
                        csrfToken={csrfToken}
                        label="Kaldır"
                        variant="danger"
                        fields={{ illustrationId: item.id }}
                        confirmMessage={`"${item.title}" kaldırılsın mı? Dosya silinir, çizer de göremez; geri alınamaz.`}
                      />
                    )}
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
