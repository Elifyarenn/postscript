import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { listPendingGrants } from "@/services/rights";
import { getRightsTemplate } from "@/services/settings";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { sendRemindersAction } from "../actions";

export const metadata = { title: "Devir formu takibi" };

export default async function EditorRightsPage() {
  const { user } = await guardPanel("editor");
  const csrfToken = (await readCsrfToken()) ?? "";

  const pending = await listPendingGrants({ ...user });
  const template = await getRightsTemplate();

  return (
    <>
      <PageHeader
        title="Devir formu takibi"
        description="İmza bekleyen formlar. İmzalanmadan hiçbir yazı yayına alınamaz."
      />

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg">Bekleyen formlar ({pending.length})</h2>

            <PanelForm
              action={sendRemindersAction}
              csrfToken={csrfToken}
              submitLabel="Hatırlatma gönder"
              submitVariant="secondary"
            >
            </PanelForm>
          </div>

          <Alert tone="info">
            Hatırlatma, üç günden uzun süredir bekleyen ve son üç gün içinde hatırlatılmamış
            formlara gönderilir.
          </Alert>

          <div className="mt-4">
            {pending.length === 0 ? (
              <EmptyState>Bekleyen form yok.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Eser</Th>
                    <Th>Yazar</Th>
                    <Th>Açılış</Th>
                    <Th>Son hatırlatma</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((grant) => (
                      <tr key={grant.id}>
                        <Td>{grant.articleTitle}</Td>
                        <Td className="text-xs">{grant.writerName}</Td>
                        <Td className="text-xs">
                          {formatDate(grant.createdAt)}
                          {grant.isOverdue && (
                            <span className="ml-2 text-warning">gecikmiş</span>
                          )}
                        </Td>
                        <Td className="text-xs">
                          {grant.reminderSentAt ? formatDate(grant.reminderSentAt) : "—"}
                        </Td>
                        <Td className="text-right">
                          <Link
                            href={`/editor/articles/${grant.articleId}`}
                            className="text-xs text-accent underline"
                          >
                            Makale
                          </Link>
                        </Td>
                      </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Geçerli form şablonu</h2>
          <p className="mb-4 text-sm text-muted">
            Yeni açılan formlar bu varsayılanlarla gelir. Şablonu yalnızca yönetici değiştirir.
          </p>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Sözleşme türü</dt>
              <dd>{template.grantType}</dd>
            </div>
            <div>
              <dt className="text-muted">Süre</dt>
              <dd>
                {template.exclusivityMonths === null || template.exclusivityMonths === 0
                  ? "Süresiz"
                  : `${template.exclusivityMonths} ay`}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Mecralar</dt>
              <dd>{template.channels.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Ticari kullanım</dt>
              <dd>{template.commercialUseIncluded ? "Dahil" : "Dahil değil"}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
