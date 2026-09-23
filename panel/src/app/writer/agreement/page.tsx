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
import { listUncoveredSubmissions } from "@/services/rights";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { PanelForm } from "@/components/form";
import { AgreementAcceptForm } from "./accept-form";
import { acceptAgreementAction, confirmUncoveredSubmissionsAction } from "../actions";

export const metadata = { title: "Yazar sözleşmesi" };

// The current version and the acceptance both come from the database
export const dynamic = "force-dynamic";

/**
 * The contract the writer accepts once (D-238).
 *
 * Accepting is the only place a writer is shown the whole text and asked. After
 * that there is no per-work checkbox: sending a work to the editors is itself
 * the licence declaration for that work, which is what the contract says and
 * what the submit screen repeats.
 *
 * Two things deliberately do not happen here. A new version never inherits an
 * old acceptance — the writer is shown the new text and asked again. And works
 * submitted before any acceptance are not swept in: they are listed below and
 * confirmed in one explicit step.
 */
export default async function WriterAgreementPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const [profileRows, current, acceptances] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)).limit(1),
    getCurrentAgreement(),
    listAcceptancesForUser(user.id),
  ]);
  const profile = profileRows[0]!;

  const acceptedCurrent = current
    ? (acceptances.find((row) => row.version === current.version) ?? null)
    : null;

  let rendered: { html: string; hash: string } | null = null;
  let renderError: string | null = null;
  if (current && !acceptedCurrent) {
    try {
      const preview = await renderAgreementForWriter(profile);
      rendered = { html: await renderMarkdown(preview.markdown), hash: preview.hash };
    } catch (error) {
      renderError =
        error instanceof AgreementRenderError
          ? `Sözleşme ayarları eksik: ${error.placeholders.join(", ")}. Yöneticiye bildirin.`
          : "Sözleşme metni hazırlanamadı. Yöneticiye bildirin.";
    }
  }

  // Only worth asking about once the contract is in place
  const uncovered = acceptedCurrent ? await listUncoveredSubmissions({ ...user }) : [];

  return (
    <>
      <PageHeader
        title="Yazar sözleşmesi"
        description="Bir kez kabul edilir. Sonraki yazılar için yeniden kabul istenmez."
      />

      {!current && (
        <Card>
          <EmptyState>
            Yayınlanmış bir sözleşme sürümü yok. Yönetim sürümü yayınladığında burada
            görüntüleyip kabul edebileceksiniz.
          </EmptyState>
        </Card>
      )}

      {current && acceptedCurrent && (
        <Card>
          <h2 className="mb-2 font-serif text-lg">Sözleşmeyi kabul ettiniz</h2>
          <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted">Sürüm</dt>
            <dd>{acceptedCurrent.version}</dd>
            <dt className="text-muted">Kabul tarihi</dt>
            <dd>{formatDateTime(acceptedCurrent.acceptedAt)}</dd>
          </dl>
          {acceptedCurrent.pdfMediaId && (
            <p className="mt-4 text-sm">
              <Link
                href={`/api/media/${acceptedCurrent.pdfMediaId}`}
                className="text-accent underline"
              >
                Kabul ettiğiniz metnin PDF kopyasını indirin
              </Link>
            </p>
          )}
          <p className="mt-4 text-sm text-muted">
            Bundan sonra kendi hesabınızdan &ldquo;İncelemeye gönder&rdquo; dediğiniz her
            yazı için, bu sözleşmedeki koşullarla yayın izni vermiş olursunuz. Her
            gönderimde ayrıca onay istenmez. İzin, derginin yazıyı yayımlama taahhüdü
            değildir.
          </p>
        </Card>
      )}

      {current && !acceptedCurrent && (
        <Card>
          {acceptances.length > 0 && (
            <div className="mb-4">
              <Alert tone="warning" title="Sözleşmenin yeni bir sürümü var">
                Daha önce {acceptances[0]!.version}. sürümü kabul etmiştiniz. Yeni sürüm
                eski kabulünüzü kendiliğinden devralmaz; aşağıdaki metni okuyup yeniden
                kabul etmeniz gerekiyor. Önceki kabulünüz ve o sürüm altında verdiğiniz
                izinler olduğu gibi kalır.
              </Alert>
            </div>
          )}

          {renderError ? (
            <Alert tone="danger">{renderError}</Alert>
          ) : (
            rendered && (
              <AgreementAcceptForm
                action={acceptAgreementAction}
                csrfToken={csrfToken}
                agreementVersionId={current.id}
                renderedHash={rendered.hash}
                html={rendered.html}
              />
            )
          )}
        </Card>
      )}

      {uncovered.length > 0 && (
        <Card>
          <h2 className="mb-1 font-serif text-lg">
            Sözleşmeden önce gönderdiğiniz yazılar ({uncovered.length})
          </h2>
          <p className="mb-4 text-sm text-muted">
            Bu yazıları sözleşmeyi kabul etmeden önce göndermiştiniz, bu yüzden yayın
            izni beyanı kapsamında değiller. Sözleşmeyi kabul etmeniz bunları
            kendiliğinden kapsamaz. Aşağıdaki listeyi okuyup tek seferde teyit
            edebilirsiniz; teyit ettiğinizde her yazı için o yazının o anki metniyle
            ayrı bir izin kaydı oluşur.
          </p>
          <ul className="mb-4 divide-y divide-line text-sm">
            {uncovered.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                <Link href={`/writer/articles/${item.id}`} className="text-accent underline">
                  {item.title}
                </Link>
                <StatusBadge status={item.status} />
                {item.version !== null && (
                  <span className="text-xs text-muted">sürüm {item.version}</span>
                )}
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
    </>
  );
}
