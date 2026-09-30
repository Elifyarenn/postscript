import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { isAppError } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { DOCUMENT_KIND_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/contributor-documents";
import { viewContributorDocument } from "@/services/contributor-documents";
import { documentPdfHref } from "@/components/contributor-documents";
import { Alert, Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Katkı sağlayan belgesi" };

// The preview is drawn from today's records
export const dynamic = "force-dynamic";

/**
 * One contributor document as the admin reads it (D-278): the text prepared
 * for that person, or, while it waits for review, a preview with each missing
 * value marked where it would go.
 */
export default async function ContributorDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardPanel("admin");
  const { id } = await params;

  let view;
  try {
    view = await viewContributorDocument({ ...user }, id);
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
  const { item } = view;
  // Rendered and sanitised on the server, like every other contract text
  const html = view.markdown ? await renderMarkdown(view.markdown) : null;

  return (
    <>
      <PageHeader
        title={DOCUMENT_KIND_LABELS[item.kind]}
        description={item.articleTitle ? `${item.userName} · ${item.articleTitle}` : item.userName}
        actions={
          <Link href="/admin/agreements" className="text-sm text-accent underline">
            Belgelere dön
          </Link>
        }
      />

      <div className="space-y-6">
        <Card>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Katkı sağlayan</dt>
              <dd>
                <Link href={`/admin/users/${item.userId}`} className="underline">
                  {item.userName}
                </Link>{" "}
                <StatusBadge status={item.userRole} />
                <span className="block text-xs text-muted">{view.ownerEmail}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Eser</dt>
              <dd>
                {item.articleTitle ?? "—"}
                {item.articleStatus && (
                  <span className="ml-2">
                    <StatusBadge status={item.articleStatus} />
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Durum</dt>
              <dd>{DOCUMENT_STATUS_LABELS[item.status]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Hazırlanma</dt>
              <dd>
                {formatDateTime(item.createdAt)}
                {item.kind === "general_agreement" && <span className="text-muted"> · sürüm {item.templateVersion}</span>}
              </dd>
            </div>
            {item.textHash && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted">Metin özeti (SHA-256)</dt>
                <dd className="break-all font-mono text-xs">{item.textHash}</dd>
              </div>
            )}
          </dl>
          {item.status === "prepared" && (
            <p className="mt-4">
              <a href={documentPdfHref(item.id)} className="text-sm text-accent underline">
                PDF indir
              </a>
            </p>
          )}
        </Card>

        {item.reviewReasons.length > 0 && (
          <Alert tone="warning" title="İnceleme gerekiyor">
            <ul className="list-disc pl-4">
              {item.reviewReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </Alert>
        )}

        {view.unavailable && <Alert tone="danger">{view.unavailable}</Alert>}

        {html && (
          <Card>
            {view.isPreview && (
              <p className="mb-4 text-sm text-muted">
                Önizleme: bu belge henüz hazır değil. Metin bugünkü kayıtlardan çizildi; eksik bilgiler
                <strong> [EKSİK: …]</strong> olarak işaretli. Kaydedilmez, PDF&apos;i yoktur.
              </p>
            )}
            <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: html }} />
          </Card>
        )}
      </div>
    </>
  );
}
