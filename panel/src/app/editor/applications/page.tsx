import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { listApplicationsByStatus } from "@/services/writer-applications";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { editorApproveApplicationAction, editorRejectApplicationAction } from "../actions";

export const metadata = { title: "Yazar başvuruları" };

/**
 * Stage one of the writer application pipeline. The editor sees everything
 * that is still `submitted`; approving passes it to the admin, rejecting
 * closes it with a reason the applicant receives by e-mail.
 */
export default async function EditorApplicationsPage() {
  const { user } = await guardAdminWithinEditor();
  const csrfToken = (await readCsrfToken()) ?? "";

  const queue = await listApplicationsByStatus({ ...user }, ["submitted"], 100);

  return (
    <>
      <PageHeader
        title="Yazar başvuruları"
        description="Aşama 1: editör incelemesi. Onaylanan başvurular yönetim onayına gider."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Bekleyen başvurular ({queue.length})</h2>

          {queue.length === 0 ? (
            <EmptyState>İnceleme bekleyen başvuru yok.</EmptyState>
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
                      action={editorApproveApplicationAction}
                      csrfToken={csrfToken}
                      submitLabel="Onayla"
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
                      action={editorRejectApplicationAction}
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

        <Alert tone="info">
          Onayladığınız başvurular bir sonraki aşamada yönetim panelinde görünür; süreçte
          başka bir editör adımı yoktur.
        </Alert>
      </div>
    </>
  );
}