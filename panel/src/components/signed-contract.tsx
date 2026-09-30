/**
 * The member's side of the signed contract (D-275): what they uploaded and
 * what happened to it, and the form to upload a PDF. Shared by "Sözleşmem"
 * in the writer panel and the applicant's contract page.
 */
import Link from "next/link";
import type { ServerAction } from "@/components/form";
import { PanelForm } from "@/components/form";
import { Field, Input, Table, Td, Th } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { OwnSignedContract } from "@/services/signed-contracts";

export const SIGNED_CONTRACT_STATUS_LABELS = {
  pending: "İnceleniyor",
  approved: "Doğrulandı",
  rejected: "Reddedildi",
} as const;

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
          <Th>Sürüm</Th>
          <Th>Durum</Th>
          <Th>Dosya</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td className="text-xs">{formatDateTime(row.uploadedAt)}</Td>
            <Td>v{row.version}</Td>
            <Td className="text-xs">
              <span className={STATUS_CLASS[row.status]}>{SIGNED_CONTRACT_STATUS_LABELS[row.status]}</span>
              {row.reviewedAt && <span className="text-muted"> · {formatDateTime(row.reviewedAt)}</span>}
              {row.status === "rejected" && row.rejectionReason && (
                <p className="mt-1 text-ink">Neden: {row.rejectionReason}</p>
              )}
            </Td>
            <Td className="text-xs">
              <Link href={`/api/media/${row.fileMediaId}`} className="text-accent underline">
                PDF
              </Link>
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
}: {
  action: ServerAction;
  csrfToken: string;
  maxMb: number;
}) {
  return (
    <PanelForm action={action} csrfToken={csrfToken} submitLabel="İmzalı sözleşmeyi yükle">
      <Field label={`İmzalı sözleşme (yalnızca PDF, en fazla ${maxMb} MB)`} htmlFor="signed-contract-file">
        <Input id="signed-contract-file" name="file" type="file" required accept=".pdf,application/pdf" />
      </Field>
    </PanelForm>
  );
}
