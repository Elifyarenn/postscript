import { guardPanel } from "@/lib/auth/guard";
import { getCurrentAgreement, listAcceptancesForUser } from "@/services/agreements";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { AgreementAcceptForm } from "./accept-form";
import { acceptAgreementAction } from "../actions";

export const metadata = { title: "Çerçeve sözleşme" };

export default async function WriterAgreementPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const current = await getCurrentAgreement();
  const acceptances = await listAcceptancesForUser(user.id);

  const acceptedCurrent =
    current !== null && acceptances.some((row) => row.version === current.version);

  return (
    <>
      <PageHeader
        title="Çerçeve sözleşme"
        description="Yazar ile dergi arasındaki genel çerçeve. Eser bazlı devir formları bunun ekidir."
      />

      <div className="space-y-6">
        {current === null ? (
          <EmptyState>Henüz yayınlanmış bir çerçeve sözleşme yok.</EmptyState>
        ) : acceptedCurrent ? (
          <Card>
            <Alert tone="success" title={`Sürüm ${current.version} onaylandı`}>
              Güncel sözleşmeyi onayladınız. Yeni bir sürüm yayınlanırsa burada tekrar onay
              istenecek.
            </Alert>
            <div
              className="prose-panel mt-5 max-h-[28rem] overflow-y-auto border-t border-line pt-5 text-sm"
              dangerouslySetInnerHTML={{ __html: await renderMarkdown(current.bodyMarkdown) }}
            />
          </Card>
        ) : (
          <Card>
            <h2 className="mb-1 font-serif text-lg">
              {current.title} — sürüm {current.version}
            </h2>
            <p className="mb-4 text-xs text-muted">
              Metin özeti (sha256): <code className="break-all">{current.bodyHash}</code>
            </p>

            <AgreementAcceptForm
              action={acceptAgreementAction}
              csrfToken={csrfToken}
              agreementVersionId={current.id}
              bodyHash={current.bodyHash}
              html={await renderMarkdown(current.bodyMarkdown)}
            />
          </Card>
        )}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Onay geçmişiniz</h2>

          {acceptances.length === 0 ? (
            <EmptyState>Henüz bir sözleşme onaylamadınız.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sürüm</Th>
                  <Th>Onay tarihi</Th>
                  <Th>Durum</Th>
                  <Th>PDF</Th>
                </tr>
              </thead>
              <tbody>
                {acceptances.map((row) => (
                  <tr key={row.acceptanceId}>
                    <Td>v{row.version}</Td>
                    <Td className="text-xs">{formatDateTime(row.acceptedAt)}</Td>
                    <Td className="text-xs">
                      {row.supersededAt ? "Yeni sürümle değiştirildi" : "Güncel"}
                    </Td>
                    <Td>
                      {row.pdfMediaId ? (
                        <a
                          href={`/api/media/${row.pdfMediaId}`}
                          className="text-accent underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          İndir
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
