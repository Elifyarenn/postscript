import Link from "next/link";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { renderGrantForWriter } from "@/services/rights";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { GrantDecision } from "./decision";
import { declineGrantAction, signGrantAction } from "../../actions";

export const metadata = { title: "Devir formu" };

export default async function RightsGrantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await guardWriterInnerPages();
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  // Throws 403 when this form belongs to someone else
  const { grant, article, formText, formTextHash } = await renderGrantForWriter({ ...user }, id);

  return (
    <>
      <PageHeader
        title="Eser bazlı hak devri formu"
        description={article.title}
        actions={<StatusBadge status={grant.status} />}
      />

      <div className="space-y-6">
        <Card>
          {/* The exact text whose hash is recorded with the signature */}
          <pre className="max-h-[32rem] overflow-y-auto rounded-md border border-line bg-paper p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap">
            {formText}
          </pre>
          <p className="mt-3 text-xs text-muted">
            Form özeti (sha256): <code className="break-all">{formTextHash}</code>
          </p>
        </Card>

        {grant.status === "pending" && (
          <Card>
            <GrantDecision
              signAction={signGrantAction}
              declineAction={declineGrantAction}
              csrfToken={csrfToken}
              grantId={grant.id}
              formTextHash={formTextHash}
            />
          </Card>
        )}

        {grant.status === "signed" && (
          <Card>
            <Alert tone="success" title="Bu formu imzaladınız">
              İmza tarihi: {formatDateTime(grant.signedAt)}
              <br />
              IP: {grant.signedIp ?? "—"}
            </Alert>
            {grant.formPdfMediaId && (
              <a
                href={`/api/media/${grant.formPdfMediaId}`}
                className="mt-4 inline-block text-sm text-accent underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                İmzalı formun PDF kopyasını indir
              </a>
            )}
          </Card>
        )}

        {grant.status === "declined" && (
          <Card>
            <Alert tone="danger" title="Bu formu reddettiniz">
              Gerekçe: {grant.declinedReason}
              <br />
              Tarih: {formatDateTime(grant.declinedAt)}
            </Alert>
          </Card>
        )}

        {grant.status === "revoked" && (
          <Alert tone="warning">
            Bu form iptal edildi. Yerine yeni bir form açılmış olabilir.
          </Alert>
        )}

        <p className="text-sm">
          <Link href="/writer/rights" className="text-muted underline hover:text-ink">
            Tüm formlara dön
          </Link>
        </p>
      </div>
    </>
  );
}
