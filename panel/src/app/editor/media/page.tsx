import { guardPanel } from "@/lib/auth/guard";
import { articlesUsingMedia, listMedia, MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "@/services/media";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { updateMediaLicenseAction, uploadMediaAction } from "../actions";

export const metadata = { title: "Medya kütüphanesi" };

const LICENSE_OPTIONS = [
  ["own_work", "Kendi eserimiz"],
  ["cc0", "CC0"],
  ["cc_by", "CC BY"],
  ["stock_licensed", "Lisanslı stok"],
  ["permission_letter", "İzin yazısı var"],
  ["contract_pdf", "Sözleşme PDF"],
  ["other", "Diğer"],
] as const;

export default async function EditorMediaPage() {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";

  const items = await listMedia(actor, 100);
  const usage = await Promise.all(
    items.map(async (item) => ({ id: item.id, count: (await articlesUsingMedia(item.id)).length })),
  );
  const usageById = new Map(usage.map((row) => [row.id, row.count]));

  return (
    <>
      <PageHeader
        title="Medya kütüphanesi"
        description="Lisans bilgisi girilmemiş görseller makaleye eklenemez."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Yükle</h2>

          <Alert tone="info">
            Kabul edilen türler: JPEG, PNG, GIF, WEBP ve PDF. Görsellerde sınır{" "}
            {MAX_IMAGE_BYTES / 1024 / 1024} MB, PDF&apos;lerde {MAX_PDF_BYTES / 1024 / 1024} MB.
            Dosya türü içeriğinden doğrulanır.
          </Alert>

          <div className="mt-4">
            <PanelForm action={uploadMediaAction} csrfToken={csrfToken} submitLabel="Yükle">
                <>
                  <Field label="Dosya" htmlFor="file">
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      required
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    />
                  </Field>

                  <Field
                    label="Lisans türü"
                    htmlFor="licenseType"
                  >
                    <Select id="licenseType" name="licenseType" required>
                      {LICENSE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Lisans kaynağı"
                    htmlFor="licenseSource"
                    hint="Bağlantı veya kısa açıklama."
                  >
                    <Input id="licenseSource" name="licenseSource" />
                  </Field>

                  <Field label="Alternatif metin" htmlFor="altText">
                    <Input id="altText" name="altText" maxLength={300} />
                  </Field>
                </>
            </PanelForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Kütüphane</h2>

          {items.length === 0 ? (
            <EmptyState>Henüz görsel yüklenmedi.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Dosya</Th>
                  <Th>Tür</Th>
                  <Th>Lisans</Th>
                  <Th>Kullanım</Th>
                  <Th>Yükleme</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td className="max-w-xs truncate text-xs">{item.altText ?? item.storageKey}</Td>
                    <Td className="text-xs">{item.mime}</Td>
                    <Td className="text-xs">
                      {item.licenseType ?? <span className="text-danger">Eksik</span>}
                    </Td>
                    <Td className="text-xs">{usageById.get(item.id) ?? 0} makale</Td>
                    <Td className="text-xs">{formatDate(item.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Lisans bilgisini düzelt</h2>

          <PanelForm
            action={updateMediaLicenseAction}
            csrfToken={csrfToken}
            submitLabel="Güncelle"
            submitVariant="secondary"
          >
              <>
                <Field label="Görsel" htmlFor="mediaId">
                  <Select id="mediaId" name="mediaId" required>
                    <option value="">Seçin…</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.altText ?? item.storageKey}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Lisans türü" htmlFor="editLicenseType">
                  <Select id="editLicenseType" name="licenseType" required>
                    {LICENSE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Lisans kaynağı" htmlFor="editLicenseSource">
                  <Input id="editLicenseSource" name="licenseSource" />
                </Field>

                <Field label="Alternatif metin" htmlFor="editAltText">
                  <Input id="editAltText" name="altText" maxLength={300} />
                </Field>
              </>
          </PanelForm>
        </Card>
      </div>
    </>
  );
}
