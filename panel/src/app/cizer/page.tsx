import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardIllustratorPanel } from "@/lib/auth/guard";
import { getCurrentAgreement, renderAgreementForWriter } from "@/services/agreements";
import { listOwnSignedContracts, MAX_SIGNED_CONTRACT_MB, VERIFIED_MESSAGE } from "@/services/signed-contracts";
import { listOwnContributorDocuments } from "@/services/contributor-documents";
import { OwnDocumentsCard } from "@/components/contributor-documents";
import { AgreementRenderError } from "@/lib/agreement/render";
import { contributionRoleLabel } from "@/lib/contributor-documents";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { SignedContractHistory, SignedContractUploadForm } from "@/components/signed-contract";
import { uploadSignedContractAction } from "../writer/actions";

export const metadata = { title: "Sözleşmem" };

// The current version and the uploads both come from the database
export const dynamic = "force-dynamic";

/**
 * The çizer's contract page (D-288), the writer's "Sözleşmem" without the
 * writing: the Genel Katkı Sağlayan Sözleşmesi to sign, the signed PDF upload
 * and its verification (D-275), and the prepared documents (D-276).
 */
export default async function IllustratorPage() {
  const { user } = await guardIllustratorPanel();
  const csrfToken = (await readCsrfToken()) ?? "";

  const [profileRows, current, uploads, documents] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)).limit(1),
    getCurrentAgreement(),
    listOwnSignedContracts({ ...user }),
    listOwnContributorDocuments({ ...user }),
  ]);
  const profile = profileRows[0]!;

  // The contract's own state; a licence form's upload is shown with its document (D-289)
  const contractUploads = uploads.filter((row) => row.isContract);
  const verified = current
    ? (contractUploads.find((row) => row.status === "approved" && row.version === current.version) ?? null)
    : null;
  const pending = contractUploads.find((row) => row.status === "pending") ?? null;
  const latest = contractUploads[0] ?? null;
  // With a prepared contract document, its signed copy is uploaded on that document's row
  const contractDocument = documents.some((row) => row.kind === "general_agreement" && row.status === "prepared");
  const upload = { action: uploadSignedContractAction, csrfToken, maxMb: MAX_SIGNED_CONTRACT_MB };

  // The text to sign, shown until a signed copy of it is verified
  let rendered: string | null = null;
  let renderError: string | null = null;
  if (current && !verified) {
    try {
      const contributionRole = contributionRoleLabel({ role: profile.role, isIllustrator: profile.isIllustrator });
      rendered = await renderMarkdown((await renderAgreementForWriter({ ...profile, contributionRole })).markdown);
    } catch (error) {
      renderError =
        error instanceof AgreementRenderError
          ? `Sözleşme ayarları eksik: ${error.placeholders.join(", ")}. Yöneticiye bildirin.`
          : "Sözleşme metni hazırlanamadı. Yöneticiye bildirin.";
    }
  }

  return (
    <>
      <PageHeader
        title="Sözleşmem"
        description="Genel Katkı Sağlayan Sözleşmesi'ni imzalayıp PDF olarak yükleyin; yönetici imzalı sözleşmenizi doğrular."
      />

      <div className="space-y-6">
        {!current && (
          <Card>
            <EmptyState>Yayınlanmış bir sözleşme sürümü yok.</EmptyState>
          </Card>
        )}

        {current && verified && (
          <Alert tone="success" title={VERIFIED_MESSAGE}>
            Sürüm {verified.version} · doğrulama tarihi {formatDateTime(verified.reviewedAt)}.
          </Alert>
        )}

        {current && !verified && pending && (
          <Alert tone="info" title="Sözleşmeniz inceleniyor">
            {formatDateTime(pending.uploadedAt)} tarihinde yüklediğiniz PDF yönetici doğrulamasını bekliyor.
            Sonuçlanınca bu sayfada göreceksiniz.
          </Alert>
        )}

        {current && !verified && !pending && latest?.status === "rejected" && (
          <Alert tone="danger" title="Yüklediğiniz sözleşme reddedildi">
            <p>Neden: {latest.rejectionReason}</p>
            <p className="mt-1">Düzeltip yeni bir PDF yükleyebilirsiniz.</p>
          </Alert>
        )}

        {current && !verified && !pending && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">İmzalı sözleşmeyi yükle · sürüm {current.version}</h2>
            <p className="mb-4 text-sm text-muted">
              E-postayla gönderilen ya da aşağıdaki &ldquo;Belgelerim&rdquo; bölümünden indirdiğiniz sözleşmeyi
              yazdırıp el yazısıyla imzalayın, taratın ve PDF olarak yükleyin. Yönetici dosyayı kontrol edip
              doğrular.
            </p>
            {contractDocument ? (
              <p className="text-sm">
                İmzalı sözleşmeyi aşağıdaki &ldquo;Belgelerim&rdquo; bölümünde, Genel Katkı Sağlayan Sözleşmesi
                satırından yükleyin.
              </p>
            ) : (
              <SignedContractUploadForm
                action={uploadSignedContractAction}
                csrfToken={csrfToken}
                maxMb={MAX_SIGNED_CONTRACT_MB}
              />
            )}
            {renderError ? (
              <div className="mt-5">
                <Alert tone="danger">{renderError}</Alert>
              </div>
            ) : (
              rendered && (
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm text-accent underline">Sözleşme metnini göster</summary>
                  <div className="mt-3 max-h-[30rem] overflow-y-auto rounded-md border border-line bg-surface p-5">
                    {/* Rendered and sanitised on the server */}
                    <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: rendered }} />
                  </div>
                </details>
              )
            )}
          </Card>
        )}

        <OwnDocumentsCard items={documents} uploads={uploads} upload={upload} />

        {uploads.length > 0 && (
          <Card>
            <h2 className="mb-3 font-serif text-lg">Yüklediğim sözleşmeler</h2>
            <SignedContractHistory rows={uploads} />
          </Card>
        )}
      </div>
    </>
  );
}
