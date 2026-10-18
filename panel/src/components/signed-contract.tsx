/**
 * The member's side of the signed contract (D-275): what they uploaded and
 * what happened to it, and the form to upload a PDF. Shared by "Sözleşmem"
 * in the writer panel and the applicant's contract page.
 */
import Link from "next/link";
import type { ServerAction } from "@/components/form";
import { PanelForm } from "@/components/form";
import { PdfFileInput } from "@/components/pdf-file-input";
import { Field, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { OwnSignedContract } from "@/services/signed-contracts";

export const SIGNED_CONTRACT_STATUS_LABELS = {
  pending: "İnceleniyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
} as const;

/**
 * A licence form is in force on both parties' signatures (D-340, form article
 * 12); the upload is only archived and checked against the form. Its labels
 * say that, and never "approved".
 */
export const SIGNED_LICENCE_STATUS_LABELS = {
  pending: "Yüklendi · arşiv kontrolü bekliyor",
  approved: "Yüklendi · arşivde doğrulandı",
  rejected: "Kopya kabul edilmedi · yeniden yükleyin",
} as const;

export function signedUploadStatusLabel(status: keyof typeof SIGNED_CONTRACT_STATUS_LABELS, isContract: boolean): string {
  return (isContract ? SIGNED_CONTRACT_STATUS_LABELS : SIGNED_LICENCE_STATUS_LABELS)[status];
}

const STATUS_CLASS = {
  pending: "text-warning",
  approved: "text-accent",
  rejected: "text-danger",
} as const;

export function SignedContractHistory({ rows }: { rows: OwnSignedContract[] }) {
  if (rows.length === 0) return null;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Yükleme</Th>
          <Th>Belge</Th>
          <Th>Durum</Th>
          <Th>Dosya</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="text-xs">{formatDateTime(row.uploadedAt)}</Td>
            <Td className="text-xs">
              {row.isContract ? `Genel Katkı Sağlayan Sözleşmesi · v${row.version}` : `Ruhsat formu · ${row.articleTitle ?? "—"}`}
            </Td>
            <Td className="text-xs">
              <span className={STATUS_CLASS[row.status]}>{signedUploadStatusLabel(row.status, row.isContract)}</span>
              {row.reviewedAt && <span className="text-muted"> · {formatDateTime(row.reviewedAt)}</span>}
              {row.status === "rejected" && row.rejectionReason && (
                <p className="mt-1 text-ink">Neden: {row.rejectionReason}</p>
              )}
            </Td>
            <Td className="text-xs">
              <Link href={`/api/media/${row.fileMediaId}`} className="text-accent underline">
                PDF
              </Link>
              {row.countersignedMediaId && (
                <Link href={`/api/media/${row.countersignedMediaId}`} className="ml-2 text-accent underline">
                  İki tarafça imzalı
                </Link>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function SignedContractUploadForm({
  action,
  csrfToken,
  maxMb,
  documentId,
  fieldName = "documentId",
  label = "İmzalı sözleşme",
}: {
  action: ServerAction;
  csrfToken: string;
  maxMb: number;
  /** The prepared document this file signs (D-289); one form per document. */
  documentId?: string;
  /** The hidden field's name; the admin's countersigned upload sends the upload's `id` (D-290). */
  fieldName?: string;
  label?: string;
}) {
  const inputId = documentId ? `signed-file-${documentId}` : "signed-contract-file";
  return (
    <PanelForm action={action} csrfToken={csrfToken} submitLabel="İmzalı PDF'i yükle">
      {documentId && <input type="hidden" name={fieldName} value={documentId} />}
      <Field label={`${label} (yalnızca PDF, en fazla ${maxMb} MB)`} htmlFor={inputId}>
        <PdfFileInput id={inputId} maxMb={maxMb} />
      </Field>
    </PanelForm>
  );
}
