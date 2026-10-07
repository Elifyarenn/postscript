import Link from "next/link";
import { notFound } from "next/navigation";
import type { Actor } from "@/lib/auth/rbac";
import { isAppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/utils";
import { previewMailJob } from "@/services/mail-queue";
import { Alert, Card, PageHeader } from "@/components/ui";

const STATUS_TEXT = { pending: "Bekliyor", processing: "Gönderiliyor", sent: "Gönderildi", failed: "Başarısız" } as const;

/**
 * One queued message as its recipient will see it (D-293): the HTML in a
 * sandboxed frame, the plain text, and the attachments by name.
 */
export async function MailPreviewView({
  user,
  id,
  basePath,
}: {
  user: Actor;
  id: string;
  basePath: "/admin/mail" | "/editor/mail";
}) {
  let mail;
  try {
    mail = await previewMailJob({ ...user }, id);
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        title="E-posta önizlemesi"
        description={mail.subject}
        actions={
          <Link href={basePath} className="text-sm text-accent underline">
            Kuyruğa dön
          </Link>
        }
      />

      <div className="space-y-6">
        <Card>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Alıcı</dt>
              <dd className="break-all">{mail.recipient}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd>
                {STATUS_TEXT[mail.status]} · oluşturma {formatDateTime(mail.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Konu</dt>
              <dd>{mail.subject}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tür</dt>
              <dd className="font-mono text-xs">{mail.kind}</dd>
            </div>
          </dl>
          {mail.attachments.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-1 text-xs text-muted">Ekler ({mail.attachments.length})</h2>
              <ul className="list-disc pl-5 text-sm">
                {mail.attachments.map((attachment, index) => (
                  <li key={`${attachment.filename}-${index}`}>
                    {attachment.filename}{" "}
                    <span className="text-xs text-muted">({Math.max(1, Math.round(attachment.bytes / 1024))} KB)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {mail.hidden ? (
          <Alert tone="info">{mail.hidden}</Alert>
        ) : (
          <>
            {mail.html && (
              <Card>
                <h2 className="mb-3 font-serif text-lg">Alıcının göreceği hâli</h2>
                {/* sandbox with no permissions: the message runs no script and opens nothing */}
                <iframe
                  title="E-posta önizlemesi"
                  sandbox=""
                  srcDoc={mail.html}
                  className="h-[640px] w-full rounded-md border border-line bg-paper"
                />
              </Card>
            )}
            {mail.text && (
              <Card>
                <h2 className="mb-3 font-serif text-lg">Düz metin</h2>
                <pre className="whitespace-pre-wrap break-words text-sm">{mail.text}</pre>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
