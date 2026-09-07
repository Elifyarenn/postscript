import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { listCategoriesWithQuota } from "@/services/leads";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "../actions";

export const metadata = { title: "Kategoriler" };

/**
 * Category quota management (module 5). Each category shows its live writer
 * count against its quota (2/3); inactive or deleted categories are hidden
 * from the public form.
 */
export default async function AdminCategoriesPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const categories = await listCategoriesWithQuota(true);

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Kontenjanlar ve aktiflik durumu. Dolu kategoriler başvuru formunda seçilemez."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Yeni kategori</h2>

          <PanelForm action={createCategoryAction} csrfToken={csrfToken} submitLabel="Ekle">
            <Field label="Kategori adı" htmlFor="name">
              <Input id="name" name="name" required minLength={2} maxLength={120} />
            </Field>
            <Field
              label="Alt başlıklar"
              htmlFor="description"
              hint="Formda kart açılınca aynen gösterilir; satır satır yazın."
            >
              <Textarea id="description" name="description" rows={4} maxLength={2000} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kontenjan" htmlFor="maxQuota">
                <Input
                  id="maxQuota"
                  name="maxQuota"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={3}
                  required
                />
              </Field>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked className="size-4" />
                  Başvuru formunda görünür
                </label>
              </div>
            </div>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">{categories.length} kategori</h2>

          {categories.length === 0 ? (
            <EmptyState>Henüz kategori yok.</EmptyState>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => {
                const percent = Math.min(
                  100,
                  Math.round((category.currentCount / category.maxQuota) * 100),
                );
                return (
                  <div
                    key={category.id}
                    className="rounded-md border border-line bg-paper p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{category.name}</span>
                        {!category.isActive && (
                          <span className="ml-2 text-xs text-danger">pasif</span>
                        )}
                      </div>
                      <span className="text-sm">
                        <strong>{category.currentCount}</strong>
                        <span className="text-muted">/{category.maxQuota}</span>
                        {category.full && (
                          <span className="ml-2 text-xs font-medium text-danger">
                            Kontenjan Dolu
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-paper">
                      <div
                        className={category.full ? "h-full bg-danger" : "h-full bg-accent"}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <PanelForm
                        action={updateCategoryAction}
                        csrfToken={csrfToken}
                        submitLabel="Kaydet"
                        submitVariant="secondary"
                      >
                        <input type="hidden" name="categoryId" value={category.id} />
                        <Field
                          label="Alt başlıklar"
                          htmlFor={`description-${category.id}`}
                          hint="Formda kart açılınca aynen gösterilir."
                        >
                          <Textarea
                            id={`description-${category.id}`}
                            name="description"
                            rows={4}
                            maxLength={2000}
                            defaultValue={category.description ?? ""}
                          />
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Kontenjan" htmlFor={`quota-${category.id}`}>
                            <Input
                              id={`quota-${category.id}`}
                              name="maxQuota"
                              type="number"
                              min={1}
                              max={100}
                              defaultValue={category.maxQuota}
                              required
                            />
                          </Field>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="isActive"
                                defaultChecked={category.isActive}
                                className="size-4"
                              />
                              Aktif
                            </label>
                          </div>
                        </div>
                      </PanelForm>

                      <div className="flex items-end">
                        <PanelForm
                          action={deleteCategoryAction}
                          csrfToken={csrfToken}
                          submitLabel="Sil"
                          submitVariant="danger"
                        >
                          <input type="hidden" name="categoryId" value={category.id} />
                        </PanelForm>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Alert tone="info">
          Silme yumuşaktır: geçmiş başvuruların kategori bağları korunur, kategori adı
          ileride yeniden kullanılabilir.
        </Alert>
      </div>
    </>
  );
}