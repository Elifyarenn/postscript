import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  getCurrentAgreement,
  listAcceptancesForUser,
  renderAgreementForWriter,
} from "@/services/agreements";
import { listOwnSignedContracts, MAX_SIGNED_CONTRACT_MB, VERIFIED_MESSAGE } from "@/services/signed-contracts";
import { listUncoveredSubmissions } from "@/services/rights";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { SignedContractHistory, SignedContractUploadForm } from "@/components/signed-contract";
import { confirmUncoveredSubmissionsAction, uploadSignedContractAction } from "../actions";

export const metadata = { title: "Sözleşmem" };

// The current version and the uploads both come from the database
export const dynamic = "force-dynamic";

/**
 * Sözleşmem (D-275): the member signs the Yazar Sözleşmesi outside the panel,
 * uploads it as a PDF, and an admin verifies it. Only a verified upload for
 * the current version counts; the checkbox acceptances from before are listed
 * as history and count for nothing.
 *
 * Works submitted before the contract are still confirmed in one explicit
 * step below, once the contract is verified (D-238).
 */
export default async function WriterAgreementPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const [profileRows, current, uploads, acceptances] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)).limit(1),
    getCurrentAgreement(),
    listOwnSignedContracts({ ...user }),
    listAcceptancesForUser(user.id),
  ]);
  const profile = profileRows[0]!;

  const verified = current
    ? (uploads.find((row) => row.status === "approved" && row.version === current.version) ?? null)
    : null;
  const pending = uploads.find((row) => row.status === "pending") ?? null;
  const latest = uploads[0] ?? null;

  // The text to sign, shown until a signed copy of it is verified
  let rendered: string | null = null;
  let renderError: string | null = null;
  if (current && !verified) {
    try {
      rendered = await renderMarkdown((await renderAgreementForWriter(profile)).markdown);
    } catch (error) {
      renderError =
        error instanceof AgreementRenderError
          ? `Sözleşme ayarları eksik: ${error.placeholders.join(", ")}. Yöneticiye bildirin.`
          : "Sözleşme metni hazırlanamadı. Yöneticiye bildirin.";
    }
  }

  // Only worth asking about once the contract is in place
  const uncovered = verified ? await listUncoveredSubmissions({ ...user }) : [];

  return (
    <>
      <PageHeader
        title="Sözleşmem"
        description="Yazar Sözleşmesi'ni imzalayıp PDF olarak yükleyin; yönetici imzalı sözleşmenizi doğrular."
      />

      <div className="space-y-6">
        {!current && (
          <Card>
            <EmptyState>
              Yayınlanmış bir sözleşme sürümü yok. Yönetim sürümü yayınladığında burada
              görüntüleyip imzalı hâlini yükleyebileceksiniz.
            </EmptyState>
          </Card>
        )}

        {current && verified && (
          <Alert tone="success" title={VERIFIED_MESSAGE}>
            Sürüm {verified.version} · doğrulama tarihi {formatDateTime(verified.reviewedAt)}. Bundan sonra
            kendi hesabınızdan &ldquo;İncelemeye gönder&rdquo; dediğiniz her yazı için bu sözleşmedeki
            koşullarla yayın izni vermiş olursunuz.
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
            <h2 className="mb-1 font-serif text-lg">Sürüm {current.version}</h2>
            <p className="mb-4 text-sm text-muted">
              Aşağıdaki metni imzalayın ve imzalı hâlini PDF olarak yükleyin. Yüklemeden sonra yönetici
              dosyayı kontrol eder; doğrulanana kadar yeni yazı gönderemezsiniz.
            </p>
            {renderError ? (
              <Alert tone="danger">{renderError}</Alert>
            ) : (
              rendered && (
                <div className="mb-5 max-h-[30rem] overflow-y-auto rounded-md border border-line bg-surface p-5">
                  {/* Rendered and sanitised on the server */}
                  <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: rendered }} />
                </div>
              )
            )}
            <SignedContractUploadForm
              action={uploadSignedContractAction}
              csrfToken={csrfToken}
              maxMb={MAX_SIGNED_CONTRACT_MB}
            />
          </Card>
        )}

        {uploads.length > 0 && (
          <Card>
            <h2 className="mb-3 font-serif text-lg">Yüklediğim sözleşmeler</h2>
            <SignedContractHistory rows={uploads} />
          </Card>
        )}

        {acceptances.length > 0 && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Önceki onay kayıtları</h2>
            <p className="mb-3 text-sm text-muted">
              Eski onay kutusu kayıtlarınız saklanıyor, ancak imzalı sözleşme doğrulaması yerine geçmez.
            </p>
            <ul className="space-y-1 text-sm">
              {acceptances.map((row) => (
                <li key={row.acceptanceId}>
                  Sürüm {row.version} · {formatDateTime(row.acceptedAt)}
                  {row.pdfMediaId && (
                    <>
                      {" · "}
                      <Link href={`/api/media/${row.pdfMediaId}`} className="text-accent underline">
                        PDF
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {uncovered.length > 0 && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">
              Sözleşmeden önce gönderdiğiniz yazılar ({uncovered.length})
            </h2>
            <p className="mb-4 text-sm text-muted">
              Bu yazıları sözleşmeniz doğrulanmadan önce göndermiştiniz, bu yüzden yayın izni beyanı
              kapsamında değiller. Sözleşmenizin doğrulanması bunları kendiliğinden kapsamaz. Aşağıdaki
              listeyi okuyup tek seferde teyit edebilirsiniz; teyit ettiğinizde her yazı için o yazının o
              anki metniyle ayrı bir izin kaydı oluşur.
            </p>
            <ul className="mb-4 divide-y divide-line text-sm">
              {uncovered.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                  <Link href={`/writer/articles/${item.id}`} className="text-accent underline">
                    {item.title}
                  </Link>
                  <StatusBadge status={item.status} />
                  {item.version !== null && <span className="text-xs text-muted">sürüm {item.version}</span>}
                </li>
              ))}
            </ul>
            <PanelForm
              action={confirmUncoveredSubmissionsAction}
              csrfToken={csrfToken}
              submitLabel={`${uncovered.length} yazı için izin beyanını teyit et`}
            >
              <input type="hidden" name="confirm" value="evet" />
            </PanelForm>
          </Card>
        )}
      </div>
    </>
  );
}
