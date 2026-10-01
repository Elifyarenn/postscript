/**
 * The contributor's own prepared documents (D-276): the contract and one
 * licence form per work, each as a PDF to print, sign by hand and upload.
 * Each prepared document takes its own signed copy (D-289): as many uploads
 * as documents were sent.
 */
import Link from "next/link";
import type { ServerAction } from "@/components/form";
import { Card, Table, Td, Th } from "@/components/ui";
import { SIGNED_CONTRACT_STATUS_LABELS, SignedContractUploadForm } from "@/components/signed-contract";
import { DOCUMENT_KIND_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/contributor-documents";
import type { ContributorDocumentItem } from "@/services/contributor-documents";
import type { OwnSignedContract } from "@/services/signed-contracts";

export function documentPdfHref(id: string): string {
  return `/api/contributor-documents/${id}/pdf`;
}

export function OwnDocumentsCard({
  items,
  uploads = [],
  upload,
}: {
  items: ContributorDocumentItem[];
  /** The member's signed uploads; each is matched to its document. */
  uploads?: OwnSignedContract[];
  /** Given where the member may upload the signed copies from this card. */
  upload?: { action: ServerAction; csrfToken: string; maxMb: number };
}) {
  if (items.length === 0) return null;
  const prepared = items.filter((item) => item.status === "prepared").length;
  return (
    <Card>
      <h2 className="mb-1 font-serif text-lg">Belgelerim</h2>
      <p className="mb-3 text-sm text-muted">
        Size hazırlanan sözleşme ve eser ruhsatı formları. Her belgenin PDF&apos;ini indirip el yazısıyla
        imzalayın ve imzalı hâlini o belgenin satırından yükleyin
        {upload && prepared > 0 ? ` (${prepared} belge, her biri için bir dosya)` : ""}.
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Belge</Th>
            <Th>Eser</Th>
            <Th>Durum</Th>
            <Th>PDF</Th>
            {upload && <Th>İmzalı kopya</Th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            // Newest first, so the first match is the latest upload for this document
            const latest = uploads.find((row) => row.contributorDocumentId === item.id) ?? null;
            const canUpload = item.status === "prepared" && latest?.status !== "pending" && latest?.status !== "approved";
            return (
              <tr key={item.id}>
                <Td className="text-xs">
                  {DOCUMENT_KIND_LABELS[item.kind]}
                  {item.kind === "general_agreement" && <span className="text-muted"> · sürüm {item.templateVersion}</span>}
                </Td>
                <Td className="text-xs">{item.articleTitle ?? "—"}</Td>
                <Td className="text-xs">
                  {DOCUMENT_STATUS_LABELS[item.status]}
                  {item.status === "needs_review" && (
                    <span className="block text-muted">Yönetim kontrol ediyor; hazır olunca buradan indirebilirsiniz.</span>
                  )}
                </Td>
                <Td className="text-xs">
                  {item.status === "prepared" ? (
                    <a href={documentPdfHref(item.id)} className="text-accent underline">
                      İndir
                    </a>
                  ) : (
                    "—"
                  )}
                </Td>
                {upload && (
                  <Td className="min-w-[14rem] text-xs">
                    {latest && (
                      <p className="mb-1">
                        {SIGNED_CONTRACT_STATUS_LABELS[latest.status]} ·{" "}
                        <Link href={`/api/media/${latest.fileMediaId}`} className="text-accent underline">
                          yüklenen PDF
                        </Link>
                        {latest.countersignedMediaId && (
                          <>
                            {" · "}
                            <Link href={`/api/media/${latest.countersignedMediaId}`} className="text-accent underline">
                              iki tarafça imzalı son hâli
                            </Link>
                          </>
                        )}
                        {latest.status === "rejected" && latest.rejectionReason && (
                          <span className="block text-danger">Neden: {latest.rejectionReason}</span>
                        )}
                      </p>
                    )}
                    {canUpload ? (
                      <SignedContractUploadForm
                        action={upload.action}
                        csrfToken={upload.csrfToken}
                        maxMb={upload.maxMb}
                        documentId={item.id}
                        label="İmzalı PDF"
                      />
                    ) : (
                      !latest && "—"
                    )}
                  </Td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
