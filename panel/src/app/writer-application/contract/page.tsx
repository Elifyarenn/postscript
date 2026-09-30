import { NO_INDEX } from "@/lib/seo";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, writerApplications } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { getCurrentAgreement, renderAgreementForWriter } from "@/services/agreements";
import { listOwnSignedContracts, MAX_SIGNED_CONTRACT_MB } from "@/services/signed-contracts";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";
import { SiteShell } from "@/components/site-shell";
import { Alert, Card, PageHeader } from "@/components/ui";
import { SignedContractHistory, SignedContractUploadForm } from "@/components/signed-contract";
import { uploadSignedContractAction } from "@/app/writer/actions";

export const metadata = { title: "Yazar sözleşmesi", robots: NO_INDEX };

/**
 * The contract an approved applicant signs (D-275). Only the owner of an
 * application that reached `admin_approved` can open it, and only while they
 * are still a plain user. They upload the signed PDF here; the admin's signed
 * contract verification closes the application and makes them a writer.
 */
export default async function WriterApplicationContractPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { application: applicationId } = await searchParams;

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;

  const applicationRows = applicationId
    ? await db
        .select()
        .from(writerApplications)
        .where(and(eq(writerApplications.id, applicationId)))
        .limit(1)
    : [];
  const application = applicationRows[0] ?? null;

  let error: string | null = null;
  if (!application) {
    error = "Başvuru bulunamadı.";
  } else if (application.userId !== context.user.id) {
    error = "Bu başvuru size ait değil.";
  } else if (application.status !== "admin_approved") {
    error = "Bu başvurunun sözleşmesi henüz imzalanmaya hazır değil.";
  } else if (profile.role !== "user") {
    error = "Zaten yazar veya üzeri bir role sahipsiniz.";
  }

  const uploads = error ? [] : await listOwnSignedContracts({ ...context.user });
  const pending = uploads.find((row) => row.status === "pending") ?? null;
  const latest = uploads[0] ?? null;

  let rendered: { html: string; version: number } | null = null;
  if (!error && !pending) {
    const current = await getCurrentAgreement();
    if (!current) {
      error = "Yayınlanmış bir sözleşme sürümü yok. Yöneticiye bildirin.";
    } else {
      try {
        const preview = await renderAgreementForWriter(profile);
        rendered = { html: await renderMarkdown(preview.markdown), version: current.version };
      } catch (caught) {
        error =
          caught instanceof AgreementRenderError ? caught.message : "Sözleşme şu anda gösterilemiyor.";
      }
    }
  }

  return (
    <SiteShell user={context.user}>
      <PageHeader
        title="Yazar sözleşmesi"
        description="Başvurunuz onaylandı; son adım sözleşmeyi imzalayıp PDF olarak yüklemek."
      />

      <div className="space-y-6">
        {error ? (
          <Alert tone="danger" title="Sözleşme yüklenemiyor">
            {error}
          </Alert>
        ) : pending ? (
          <Alert tone="info" title="Sözleşmeniz inceleniyor">
            {formatDateTime(pending.uploadedAt)} tarihinde yüklediğiniz PDF yönetici doğrulamasını bekliyor.
            Doğrulandığında hesabınız yazar hesabına dönüşür.
          </Alert>
        ) : rendered ? (
          <Card>
            {latest?.status === "rejected" && (
              <div className="mb-4">
                <Alert tone="danger" title="Yüklediğiniz sözleşme reddedildi">
                  <p>Neden: {latest.rejectionReason}</p>
                  <p className="mt-1">Düzeltip yeni bir PDF yükleyebilirsiniz.</p>
                </Alert>
              </div>
            )}
            <h2 className="mb-1 font-serif text-lg">Sürüm {rendered.version}</h2>
            <p className="mb-4 text-sm text-muted">
              Aşağıdaki metni imzalayın ve imzalı hâlini PDF olarak yükleyin.
            </p>
            <div className="mb-5 max-h-[30rem] overflow-y-auto rounded-md border border-line bg-surface p-5">
              {/* Rendered and sanitised on the server */}
              <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: rendered.html }} />
            </div>
            <SignedContractUploadForm
              action={uploadSignedContractAction}
              csrfToken={csrfToken}
              maxMb={MAX_SIGNED_CONTRACT_MB}
            />
          </Card>
        ) : null}

        {uploads.length > 0 && (
          <Card>
            <h2 className="mb-3 font-serif text-lg">Yüklediğim sözleşmeler</h2>
            <SignedContractHistory rows={uploads} />
          </Card>
        )}
      </div>
    </SiteShell>
  );
}
