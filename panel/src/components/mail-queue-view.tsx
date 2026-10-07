import Link from "next/link";
import type { Actor } from "@/lib/auth/rbac";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import {
  mailQueueOverview,
  MAIL_JOB_RETENTION_DAYS,
  pendingMailDrafts,
  type MailQueueFilter,
} from "@/services/mail-queue";
import type { MailJobStatus } from "@/db/schema";
import * as templates from "@emails/templates";
import { processMailQueueAction, retryMailJobAction } from "@/app/admin/mail/actions";

const STATUS_TEXT: Record<MailJobStatus, string> = {
  pending: "Bekliyor",
  processing: "Gönderiliyor",
  sent: "Gönderildi",
  failed: "Başarısız",
};

const STATUS_TONE: Record<MailJobStatus, string> = {
  pending: "border-warning/30 bg-warning-soft text-warning",
  processing: "border-line bg-paper text-muted",
  sent: "border-accent/30 bg-accent-soft text-accent",
  failed: "border-danger/30 bg-danger-soft text-danger",
};

const FILTERS: { value: MailQueueFilter; label: string }[] = [
  { value: "attention", label: "Bekleyen ve başarısız" },
  { value: "sent", label: "Gönderilen" },
  { value: "all", label: "Tümü" },
];

/**
 * The outbox screen (D-269). Rendered at /admin/mail for the admins and at
 * /editor/mail for the main editor (D-330); each route guards itself and the
 * service checks again.
 */
export async function MailQueueView({
  user,
  searchParams,
  basePath,
}: {
  user: Actor;
  searchParams: Promise<{ filter?: string }>;
  basePath: "/admin/mail" | "/editor/mail";
}) {
  const csrfToken = (await readCsrfToken()) ?? "";
  const requested = (await searchParams).filter;
  const filter: MailQueueFilter =
    requested === "sent" || requested === "all" ? requested : "attention";

  const [{ totals, jobs }, drafts] = await Promise.all([
    mailQueueOverview({ ...user }, filter),
    pendingMailDrafts({ ...user }),
  ]);

  // A sample drawn with the real layout, so the design can be checked without sending anything
  const sample = templates.verifyEmail({
    displayName: "Ad Soyad",
    url: "https://www.postscriptmag.com/verify-email?token=ornek",
  });

  return (
    <>
      <PageHeader
        title="E-posta kuyruğu"
        description={`Her e-posta önce buraya yazılır, sonra gönderilir. Başarısız gönderim en çok 6 kez, artan aralıklarla yeniden denenir. Gönderilen iletilerin içeriği hemen silinir; kayıtlar ${MAIL_JOB_RETENTION_DAYS} gün tutulur.`}
      />

      <div className="space-y-6">
        <Card>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(Object.keys(STATUS_TEXT) as MailJobStatus[]).map((status) => (
              <div key={status}>
                <dt className="text-xs text-muted">{STATUS_TEXT[status]}</dt>
                <dd className="font-serif text-2xl">{totals[status]}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-sm text-muted">
              Kuyruk her yeni e-postadan sonra, günlük zamanlanmış işte ve bu düğmeyle işlenir.
              Toplu gönderimde sıradakiler için düğmeye yeniden basılabilir.
            </p>
            <PanelForm
              action={processMailQueueAction}
              csrfToken={csrfToken}
              submitLabel="Kuyruğu şimdi işle"
              submitVariant="secondary"
            >
              <></>
            </PanelForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Gönderilmeyi bekleyen taslaklar</h2>
          <p className="mb-3 text-sm text-muted">
            Kuyruğa alınmış, henüz gönderilmemiş e-postalar. Aşağıdaki listede her birinin yanındaki
            &ldquo;Önizle&rdquo; ile alıcının göreceği hâlini ve eklerini görebilirsiniz.
          </p>
          {drafts.length === 0 ? (
            <EmptyState>Gönderilmeyi bekleyen e-posta yok.</EmptyState>
          ) : (
            <ul className="space-y-1 text-sm">
              {drafts.map((draft) => (
                <li key={draft.kind}>
                  <strong>{draft.total}</strong> · <span className="font-mono text-xs">{draft.kind}</span>
                  <span className="text-muted"> · en eskisi {formatDateTime(draft.oldest)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filtre">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                href={item.value === "attention" ? basePath : `${basePath}?filter=${item.value}`}
                className={cn(
                  "rounded-md border px-3 py-1.5",
                  item.value === filter
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-surface hover:bg-paper",
                )}
                aria-current={item.value === filter ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {jobs.length === 0 ? (
            <EmptyState>Bu filtrede e-posta yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Oluşturma</Th>
                  <Th>Alıcı ve konu</Th>
                  <Th>Durum</Th>
                  <Th>Deneme</Th>
                  <Th>Son hata / sonraki deneme</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <Td className="text-xs whitespace-nowrap">{formatDateTime(job.createdAt)}</Td>
                    <Td className="text-xs">
                      <div className="break-all">{job.recipient}</div>
                      <div className="text-muted">{job.subject}</div>
                      <div className="font-mono text-[11px] text-muted">{job.kind}</div>
                      <Link href={`${basePath}/${job.id}`} className="text-accent underline">
                        Önizle
                      </Link>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                          STATUS_TONE[job.status],
                        )}
                      >
                        {STATUS_TEXT[job.status]}
                      </span>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {job.attempts}/{job.maxAttempts}
                    </Td>
                    <Td className="text-xs">
                      {job.lastError && <div className="break-words text-danger">{job.lastError}</div>}
                      {job.status === "pending" && (
                        <div className="text-muted">Sonraki: {formatDateTime(job.nextAttemptAt)}</div>
                      )}
                      {job.status === "sent" && job.sentAt && (
                        <div className="text-muted">Gönderim: {formatDateTime(job.sentAt)}</div>
                      )}
                    </Td>
                    <Td>
                      {job.status === "failed" && !job.purged && (
                        <PanelForm
                          action={retryMailJobAction}
                          csrfToken={csrfToken}
                          submitLabel="Yeniden dene"
                          submitVariant="secondary"
                        >
                          <input type="hidden" name="jobId" value={job.id} />
                        </PanelForm>
                      )}
                      {job.status === "failed" && job.purged && (
                        <span className="text-xs text-muted">İçerik silindi</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Tasarım önizlemesi</h2>
          <p className="mb-4 text-sm text-muted">
            Bütün e-postalar aynı düzenle çizilir (<code>emails/layout.ts</code>). Örnek: e-posta
            doğrulama. HTML gösteremeyen istemciler aynı içeriğin düz metin sürümünü görür.
          </p>
          {/* sandbox with no permissions: the sample runs no script and opens nothing */}
          <iframe
            title="E-posta tasarım önizlemesi"
            sandbox=""
            srcDoc={sample.html}
            className="h-[640px] w-full rounded-md border border-line bg-paper"
          />
        </Card>
      </div>
    </>
  );
}
