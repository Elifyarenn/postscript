import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  getCurrentAgreement,
  listAcceptancesForUser,
  renderAgreementForWriter,
} from "@/services/agreements";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { AgreementAcceptForm } from "./accept-form";
import { acceptAgreementAction } from "../actions";

export const metadata = { title: "Yazar sözleşmesi" };

export default async function WriterAgreementPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const profile = rows[0]!;

  const current = await getCurrentAgreement();
  const acceptances = await listAcceptancesForUser(user.id);
  const acceptedCurrent =
    current !== null && acceptances.some((row) => row.version === current.version);

  // The contract filled with this writer's own details (§6.2)
  let rendered: { html: string; hash: string } | { error: string } | null = null;
  if (current) {
    try {
      const preview = await renderAgreementForWriter(profile);
      rendered = { html: await renderMarkdown(preview.markdown), hash: preview.hash };
    } catch (error) {
      rendered = {
        error:
          error instanceof AgreementRenderError
            ? error.message
            : "Sözleşme şu anda gösterilemiyor.",
      };
    }
  }

  return (
    <>
      <PageHeader
        title="Yazar sözleşmesi ve kullanım ruhsatı taahhüdü"
        description="Her eser için ruhsat, bu sözleşmenin 5. maddesindeki Eser Onayı ile doğar."
      />

      <div className="space-y-6">
        {current === null ? (
          <EmptyState>Henüz yayınlanmış bir sözleşme sürümü yok.</EmptyState>
        ) : rendered && "error" in rendered ? (
          <Alert tone="danger" title="Sözleşme gösterilemiyor">
            {rendered.error} Bir yöneticiye bildirin.
          </Alert>
        ) : rendered ? (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Sürüm {current.version}</h2>
            <p className="mb-4 text-xs text-muted">
              Size gösterilen metnin özeti (sha256):{" "}
              <code className="break-all">{rendered.hash}</code>
            </p>

            {acceptedCurrent ? (
              <>
                <Alert tone="success">
                  Bu sürümü onayladınız. Onayladığınız metnin kaydı ve PDF kopyası aşağıdaki
                  geçmişte duruyor.
                </Alert>
                <div
                  className="prose-panel mt-5 max-h-[30rem] overflow-y-auto border-t border-line pt-5 text-sm"
                  dangerouslySetInnerHTML={{ __html: rendered.html }}
                />
              </>
            ) : (
              <AgreementAcceptForm
                action={acceptAgreementAction}
                csrfToken={csrfToken}
                agreementVersionId={current.id}
                renderedHash={rendered.hash}
                html={rendered.html}
              />
            )}
          </Card>
        ) : null}

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
                  <Th>Onayladığınız metnin özeti</Th>
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
                    <Td className="max-w-[10rem] truncate font-mono text-[10px]">
                      {row.bodyHashAtAcceptance}
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
