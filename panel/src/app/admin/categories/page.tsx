import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm, ActionButton } from "@/components/form";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { listAllWriterAreasWithQuota } from "@/services/writer-areas";
import {
  createWriterAreaAction,
  deleteWriterAreaAction,
  updateWriterAreaAction,
} from "../actions";

export const metadata = { title: "Yazı alanları" };

/**
 * The writing areas a candidate picks from at registration (D-055). Areas
 * with writers on them can be renamed, re-quotaed, reordered or disabled, but
 * not deleted — the writers keep the area name as history.
 */
export default async function AdminCategoriesPage() {
  await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const areas = await listAllWriterAreasWithQuota();

  return (
    <>
      <PageHeader
        title="Yazı alanları"
        description="Kayıt formundaki alanları yönetin: ekleme, düzenleme, kontenjan ve sıralama."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-serif text-lg">Yeni alan</h2>
          <p className="mb-4 text-sm text-muted">
            Yeni alan, kayıt formunda en alta eklenir; sıralamayı aşağıdan
            düzenleyebilirsiniz.
          </p>
          <PanelForm action={createWriterAreaAction} csrfToken={csrfToken} submitLabel="Alan ekle">
            <>
              <Field label="Alan adı" htmlFor="areaName">
                <Input id="areaName" name="name" required maxLength={80} autoFocus={areas.length === 0} />
              </Field>
              <Field label="Kontenjan" htmlFor="areaQuota" hint="Bu alanda kaç yazar yer alabilir.">
                <Input
                  id="areaQuota"
                  name="quota"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={3}
                  required
                />
              </Field>
            </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Alanlar ({areas.length})</h2>

          {areas.length === 0 ? (
            <p className="text-sm text-muted">Henüz alan yok.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Alan</Th>
                  <Th>Durum</Th>
                  <Th>Yazarlar</Th>
                  <Th>Sıra</Th>
                  <Th>İşlem</Th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.id}>
                    <Td className="font-medium">{area.name}</Td>
                    <Td>
                      {area.isActive ? (
                        <span className="inline-block rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-block rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-muted">
                          Pasif
                        </span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {area.currentCount}/{area.quota}
                    </Td>
                    <Td className="text-sm text-muted">{area.sortOrder}</Td>
                    <Td className="w-[340px]">
                      <div className="space-y-3">
                        <PanelForm
                          action={updateWriterAreaAction}
                          csrfToken={csrfToken}
                          submitLabel="Kaydet"
                          submitVariant="secondary"
                        >
                          <>
                            <input type="hidden" name="id" value={area.id} />
                            <div className="grid grid-cols-3 gap-2">
                              <Field label="Ad" htmlFor={`area-name-${area.id}`}>
                                <Input
                                  id={`area-name-${area.id}`}
                                  name="name"
                                  defaultValue={area.name}
                                  maxLength={80}
                                />
                              </Field>
                              <Field label="Kontenjan" htmlFor={`area-quota-${area.id}`}>
                                <Input
                                  id={`area-quota-${area.id}`}
                                  name="quota"
                                  type="number"
                                  min={1}
                                  max={99}
                                  defaultValue={area.quota}
                                />
                              </Field>
                              <Field label="Sıra" htmlFor={`area-order-${area.id}`}>
                                <Input
                                  id={`area-order-${area.id}`}
                                  name="sortOrder"
                                  type="number"
                                  min={0}
                                  max={999}
                                  defaultValue={area.sortOrder}
                                />
                              </Field>
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                name="isActive"
                                defaultChecked={area.isActive}
                                className="size-4 rounded border-line"
                              />
                              Kayıt formunda gösterilsin
                            </label>
                          </>
                        </PanelForm>

                        <ActionButton
                          action={deleteWriterAreaAction}
                          csrfToken={csrfToken}
                          label="Alanı sil"
                          variant="danger"
                          fields={{ id: area.id }}
                          confirmMessage={
                            area.currentCount > 0
                              ? `Bu alanda ${area.currentCount} yazar var — yalnızca boş alanlar silinebilir.`
                              : `"${area.name}" alanı silinecek. Devam edilsin mi?`
                          }
                        />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Alert tone="info">
          Alanı silmek yalnızca içinde yazar yokken mümkündür; yazarları olan
          alanları pasife alabilirsiniz (mevcut yazarlar alan adını korur).
        </Alert>
      </div>
    </>
  );
}