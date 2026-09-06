import { guardPanel } from "@/lib/auth/guard";
import { acceptanceReport, listAgreementVersions } from "@/services/agreements";
import { readCsrfToken } from "@/lib/csrf";
import { ActionButton, PanelForm } from "@/components/form";
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
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  createAgreementDraftAction,
  publishAgreementAction,
  updateAgreementDraftAction,
} from "../actions";

export const metadata = { title: "Sözleşme sürümleri" };

export default async function AdminAgreementsPage() {
  const { user } = await guardPanel("admin");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";

  const versions = await listAgreementVersions(actor);
  const report = await acceptanceReport(actor);

  const drafts = versions.filter((version) => version.publishedAt === null);

  return (
    <>
      <PageHeader
        title="Çerçeve sözleşme sürümleri"
        description="Yayınlanmış bir sürüm değiştirilemez; değişiklik yeni sürüm demektir."
      />

      <div className="space-y-6">
        <Alert tone="warning" title="Yayınlamanın sonuçları">
          Yeni bir sürüm yayınlandığında önceki onaylar &ldquo;değiştirildi&rdquo; olarak
          işaretlenir, tüm aktif yazarlar sözleşme bekliyor durumuna düşer ve kendilerine e-posta
          gönderilir.
        </Alert>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Yeni taslak</h2>

          <PanelForm
            action={createAgreementDraftAction}
            csrfToken={csrfToken}
            submitLabel="Taslak oluştur"
          >
              <>
                <Field label="Başlık" htmlFor="title">
                  <Input
                    id="title"
                    name="title"
                    required
                    defaultValue="postscript Çerçeve Sözleşmesi"
                  />
                </Field>

                <Field
                  label="Metin (markdown)"
                  htmlFor="bodyMarkdown"
                >
                  <Textarea id="bodyMarkdown" name="bodyMarkdown" rows={16} required />
                </Field>
              </>
          </PanelForm>
        </Card>

        {drafts.map((draft) => (
          <Card key={draft.id}>
            <h2 className="mb-4 font-serif text-lg">Taslak v{draft.version}</h2>

            <PanelForm
              action={updateAgreementDraftAction}
              csrfToken={csrfToken}
              submitLabel="Taslağı kaydet"
              submitVariant="secondary"
            >
              <input type="hidden" name="versionId" value={draft.id} />
              <Field label="Başlık" htmlFor={`title-${draft.id}`}>
                <Input id={`title-${draft.id}`} name="title" defaultValue={draft.title} required />
              </Field>
              <Field label="Metin (markdown)" htmlFor={`body-${draft.id}`}>
                <Textarea
                  id={`body-${draft.id}`}
                  name="bodyMarkdown"
                  rows={16}
                  defaultValue={draft.bodyMarkdown}
                  required
                />
              </Field>
            </PanelForm>

            {/* Publishing is its own form: a form nested inside another one is
                dropped by the browser, and the button would submit the outer
                form instead of this action */}
            <div className="mt-5 border-t border-line pt-4">
              <ActionButton
                action={publishAgreementAction}
                csrfToken={csrfToken}
                label="Bu sürümü yayınla"
                variant="primary"
                fields={{ versionId: draft.id }}
                confirmMessage="Bu sürüm yayınlanacak ve tüm aktif yazarlar yeniden onay verene kadar kilitlenecek. Devam edilsin mi?"
              />
            </div>
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
                  <Th>sha256</Th>
                  <Th>PDF</Th>
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
                    <Td>
                      {version.pdfMediaId ? (
                        <a
                          href={`/api/media/${version.pdfMediaId}`}
                          className="text-xs text-accent underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          İndir
                        </a>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
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
