import { guardPanel } from "@/lib/auth/guard";
import { listApplicationsByStatus } from "@/services/writer-applications";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { adminApproveApplicationAction, adminRejectApplicationAction } from "../actions";

export const metadata = { title: "Yazar başvuruları" };

/**
 * Stage two of the writer application pipeline. The admin decides on the
 * applications an editor already approved; approving defines the contract the
 * applicant will sign. The table below is the full pipeline overview.
 */
export default async function AdminApplicationsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const queue = await listApplicationsByStatus({ ...user }, ["editor_approved"], 100);
  const all = await listApplicationsByStatus(
    { ...user },
    ["submitted", "editor_approved", "admin_approved", "signed", "editor_rejected", "admin_rejected"],
    200,
  );

  return (
    <>
      <PageHeader
        title="Yazar başvuruları"
        description="Aşama 2: yönetim onayı. Onaylanan başvuruya sözleşme tanımlanır."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Yönetim onayı bekleyenler ({queue.length})</h2>

          {queue.length === 0 ? (
            <EmptyState>Onay bekleyen başvuru yok.</EmptyState>
          ) : (
            <div className="space-y-6">
              {queue.map((application) => (
                <article
                  key={application.id}
                  className="rounded-md border border-line bg-paper p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{application.applicantName}</h3>
                      <p className="text-xs text-muted">
                        {application.applicantEmail} · başvuru{" "}
                        {formatDateTime(application.submittedAt)}
                        {application.editorName &&
                          ` · editör onayı: ${application.editorName} (${formatDate(
                            application.editorReviewedAt,
                          )})`}
                      </p>
                    </div>
                    {application.sampleMediaId && (
                      <a
                        href={`/api/media/${application.sampleMediaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent underline"
                      >
                        Örnek eseri indir
                      </a>
                    )}
                  </div>

                  {application.note && (
                    <p className="mb-4 whitespace-pre-wrap rounded-md border border-line bg-surface p-3 text-sm">
                      {application.note}
                    </p>
                  )}

                  <div className="grid gap-6 lg:grid-cols-2">
                    <PanelForm
                      action={adminApproveApplicationAction}
                      csrfToken={csrfToken}
                      submitLabel="Onayla ve sözleşme tanımla"
                    >
                      <input type="hidden" name="applicationId" value={application.id} />
                      <Field
                        label="Not (isteğe bağlı)"
                        htmlFor={`approve-note-${application.id}`}
                      >
                        <Input id={`approve-note-${application.id}`} name="note" maxLength={1000} />
                      </Field>
                    </PanelForm>

                    <PanelForm
                      action={adminRejectApplicationAction}
                      csrfToken={csrfToken}
                      submitLabel="Reddet"
                      submitVariant="danger"
                    >
                      <input type="hidden" name="applicationId" value={application.id} />
                      <Field
                        label="Ret gerekçesi"
                        htmlFor={`reject-note-${application.id}`}
                        hint="Başvuru sahibine e-posta ile gider."
                      >
                        <Textarea
                          id={`reject-note-${application.id}`}
                          name="note"
                          required
                          maxLength={1000}
                        />
                      </Field>
                    </PanelForm>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Tüm başvurular ({all.length})</h2>

          {all.length === 0 ? (
            <EmptyState>Henüz başvuru yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Başvuru sahibi</Th>
                  <Th>Durum</Th>
                  <Th>Başvuru</Th>
                  <Th>Editör onayı</Th>
                  <Th>Yönetim onayı</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {all.map((application) => (
                  <tr key={application.id}>
                    <Td>
                      <span className="font-medium">{application.applicantName}</span>
                      <span className="block text-xs text-muted">
                        {application.applicantEmail}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={application.status} />
                    </Td>
                    <Td className="text-xs">{formatDateTime(application.submittedAt)}</Td>
                    <Td className="text-xs">
                      {application.editorReviewedAt
                        ? `${application.editorName ?? "—"} · ${formatDate(
                            application.editorReviewedAt,
                          )}`
                        : "—"}
                    </Td>
                    <Td className="text-xs">
                      {application.adminReviewedAt
                        ? `${application.adminName ?? "—"} · ${formatDate(
                            application.adminReviewedAt,
                          )}`
                        : "—"}
                    </Td>
                    <Td className="text-right">
                      {application.sampleMediaId && (
                        <a
                          href={`/api/media/${application.sampleMediaId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-accent underline"
                        >
                          Örnek eser
                        </a>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Alert tone="info">
          Onaylanan başvuruya o anki güncel sözleşme sürümü tanımlanır; başvuru sahibi
          imzaladığında hesabı otomatik olarak yazar rolüne geçer.
        </Alert>
      </div>
    </>
  );
}