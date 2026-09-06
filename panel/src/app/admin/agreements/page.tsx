import { guardPanel } from "@/lib/auth/guard";
import { acceptanceReport, listAgreementVersions } from "@/services/agreements";
import { getSiteSettings, PLACEHOLDER_BY_KEY, SETTING_LABELS } from "@/services/site-settings";
import { readAgreementTemplate, templateHash, TEMPLATE_FILE } from "@/lib/agreement/template";
import { extractPlaceholders } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { ActionButton, PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createVersionFromTemplateAction, publishAgreementAction } from "../actions";

export const metadata = { title: "Sözleşme sürümleri" };

/** Every placeholder the dictionary can fill, in the order §3 lists them. */
const KNOWN_PLACEHOLDERS = [
  "agreement.version",
  "agreement.published_at",
  "agreement.body_hash",
  "dergi.ortak_1",
  "dergi.ortak_2",
  "dergi.adres",
  "dergi.eposta",
  "dergi.domain",
  "dergi.sehir",
  "yazar.ad_soyad",
  "yazar.dogum_tarihi",
  "yazar.eposta",
  "yazar.mahlas",
  "kvkk.version",
  "acceptance.accepted_at",
  "acceptance.ip",
];

export default async function AdminAgreementsPage() {
  const { user } = await guardPanel("admin");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";

  const versions = await listAgreementVersions(actor);
  const report = await acceptanceReport(actor);
  const settings = await getSiteSettings();

  const template = readAgreementTemplate();
  const hash = templateHash();
  const used = extractPlaceholders(template);
  const unknown = used.filter((name) => !KNOWN_PLACEHOLDERS.includes(name));

  const alreadyVersioned = versions.some((version) => version.bodyHash === hash);
  const drafts = versions.filter((version) => version.publishedAt === null);

  // Which publisher details are still missing; without them nothing renders
  const missingSettings = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([key]) => key as keyof typeof SETTING_LABELS);

  return (
    <>
      <PageHeader
        title="Sözleşme sürümleri"
        description="Sözleşme metni depodaki şablon dosyasıdır. Metin değişikliği yeni sürüm demektir."
      />

      <div className="space-y-6">
        <Alert tone="warning" title="Yayınlamanın sonuçları">
          Yeni bir sürüm yayınlandığında önceki onaylar &ldquo;değiştirildi&rdquo; olarak
          işaretlenir, tüm aktif yazarlar sözleşme bekliyor durumuna düşer, bekleyen Eser
          Onayları yeni sürüm onaylanana kadar verilemez ve yazarlara e-posta gönderilir.
        </Alert>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Şablon</h2>

          <dl className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Dosya</dt>
              <dd>
                <code>contracts/{TEMPLATE_FILE}</code>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Metin özeti (sha256)</dt>
              <dd className="font-mono text-[11px] break-all">{hash}</dd>
            </div>
          </dl>

          <h3 className="mb-2 text-sm font-medium">Yer tutucular ({used.length})</h3>
          <ul className="mb-5 flex flex-wrap gap-1.5">
            {used.map((name) => {
              const isKnown = KNOWN_PLACEHOLDERS.includes(name);
              return (
                <li
                  key={name}
                  className={
                    isKnown
                      ? "rounded border border-line bg-paper px-2 py-0.5 font-mono text-[11px] text-muted"
                      : "rounded border border-danger/40 bg-danger-soft px-2 py-0.5 font-mono text-[11px] text-danger"
                  }
                >
                  {name}
                </li>
              );
            })}
          </ul>

          {unknown.length > 0 ? (
            <Alert tone="danger" title="Sözlük dışı yer tutucu var">
              Şablon şu yer tutucuları kullanıyor ama sözlükte karşılıkları yok:{" "}
              {unknown.join(", ")}. Bu hâliyle yayınlanamaz.
            </Alert>
          ) : missingSettings.length > 0 ? (
            <Alert tone="warning" title="Yayıncı bilgileri eksik">
              <ul className="mt-1 list-disc pl-5">
                {missingSettings.map((key) => (
                  <li key={key}>
                    {SETTING_LABELS[key]} <code>({PLACEHOLDER_BY_KEY[key]})</code>
                  </li>
                ))}
              </ul>
              Sistem sayfasından doldurulmadan hiçbir sözleşme render edilemez.
            </Alert>
          ) : alreadyVersioned ? (
            <Alert tone="info">
              Bu şablon metni zaten bir sürüm olarak kayıtlı. Yeni sürüm için önce dosyayı
              değiştirin.
            </Alert>
          ) : (
            <PanelForm
              action={createVersionFromTemplateAction}
              csrfToken={csrfToken}
              submitLabel="Şablondan sürüm oluştur"
            />
          )}
        </Card>

        {drafts.map((draft) => (
          <Card key={draft.id}>
            <h2 className="mb-1 font-serif text-lg">Taslak v{draft.version}</h2>
            <p className="mb-4 font-mono text-[11px] break-all text-muted">{draft.bodyHash}</p>

            <ActionButton
              action={publishAgreementAction}
              csrfToken={csrfToken}
              label="Bu sürümü yayınla"
              variant="primary"
              fields={{ versionId: draft.id }}
              confirmMessage="Bu sürüm yayınlanacak ve tüm aktif yazarlar yeniden onay verene kadar kilitlenecek. Devam edilsin mi?"
            />
          </Card>
        ))}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Sürümler</h2>

          {versions.length === 0 ? (
            <EmptyState>Henüz sürüm yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sürüm</Th>
                  <Th>Durum</Th>
                  <Th>Yayın</Th>
                  <Th>Şablon özeti</Th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <Td>v{version.version}</Td>
                    <Td className="text-xs">
                      {version.isCurrent ? (
                        <span className="text-accent">güncel</span>
                      ) : version.publishedAt ? (
                        "eski"
                      ) : (
                        "taslak"
                      )}
                    </Td>
                    <Td className="text-xs">{formatDate(version.publishedAt)}</Td>
                    <Td className="max-w-[12rem] truncate font-mono text-[10px]">
                      {version.bodyHash}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Onay raporu</h2>

          {report.current === null ? (
            <EmptyState>Yayınlanmış sürüm yok.</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-medium">
                  Onaylayanlar ({report.accepted.length})
                </h3>
                {report.accepted.length === 0 ? (
                  <p className="text-sm text-muted">Henüz kimse onaylamadı.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {report.accepted.map((row) => (
                      <li key={row.id} className="flex justify-between gap-3">
                        <span>{row.displayName}</span>
                        <span className="text-xs text-muted">{formatDateTime(row.acceptedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium">Bekleyenler ({report.pending.length})</h3>
                {report.pending.length === 0 ? (
                  <p className="text-sm text-muted">Bekleyen yazar yok.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {report.pending.map((row) => (
                      <li key={row.id}>{row.displayName}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
