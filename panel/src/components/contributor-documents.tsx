/**
 * The contributor's own prepared documents (D-276): the contract and one
 * licence form per work, each as a PDF to print, sign by hand and upload.
 */
import { Card, Table, Td, Th } from "@/components/ui";
import { DOCUMENT_KIND_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/contributor-documents";
import type { ContributorDocumentItem } from "@/services/contributor-documents";

export function documentPdfHref(id: string): string {
  return `/api/contributor-documents/${id}/pdf`;
}

export function OwnDocumentsCard({ items }: { items: ContributorDocumentItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-1 font-serif text-lg">Belgelerim</h2>
      <p className="mb-3 text-sm text-muted">
        Size hazırlanan sözleşme ve eser ruhsatı formları. PDF&apos;i indirip el yazısıyla imzalayın.
      </p>
      <Table>
        <thead>
          <tr>
            <Th>Belge</Th>
            <Th>Eser</Th>
            <Th>Durum</Th>
            <Th>PDF</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
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
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
