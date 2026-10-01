import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { listForCountersign, MAX_SIGNED_CONTRACT_MB } from "@/services/signed-contracts";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { SignedContractUploadForm } from "@/components/signed-contract";
import { uploadCountersignedAction } from "../../actions";

export const metadata = { title: "İmzalanacak sözleşmeler" };

// Verifications and signatures change from minute to minute
export const dynamic = "force-dynamic";

/**
 * The magazine's side of the signature (D-290): every contract and licence
 * form a contributor signed and an admin verified, in one place. Download
 * them one by one or all at once, sign, and upload the copy signed by both
 * sides on the same row.
 */
export default async function CountersignPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const items = await listForCountersign({ ...user });
  const waiting = items.filter((row) => !row.countersignedMediaId).length;

  return (
    <>
      <PageHeader
        title="İmzalanacak sözleşmeler"
        description="Katkı sağlayanın imzaladığı ve doğrulanan sözleşme ve ruhsat formları. İndirin, Dergi adına imzalayın, iki tarafça imzalı hâlini aynı satırdan yükleyin."
        actions={
          <Link href="/admin/agreements" className="text-sm text-accent underline">
            Sözleşme sürümleri
          </Link>
        }
      />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span>
            {items.length} doğrulanmış belge · <strong>{waiting}</strong> Dergi imzası bekliyor
          </span>
          {waiting > 0 && (
            <a href="/api/admin/signed-contracts/zip" className="rounded-md border border-line px-3 py-1.5 text-accent underline">
              İmza bekleyenlerin hepsini indir (ZIP)
            </a>
          )}
          {items.length > 0 && (
            <a href="/api/admin/signed-contracts/zip?which=all" className="text-muted underline">
              Tümünü indir (ZIP)
            </a>
          )}
        </div>

        {items.length === 0 ? (
          <EmptyState>Henüz doğrulanmış imzalı sözleşme yok.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Katkı sağlayan</Th>
                <Th>Belge</Th>
                <Th>Katkı sağlayanın imzası</Th>
                <Th>Dergi imzası</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <Td className="text-xs">
                    <Link href={`/admin/users/${row.memberId}`} className="underline">
                      {row.memberName}
                    </Link>
                  </Td>
                  <Td className="text-xs">
                    {row.isContract ? `Genel Katkı Sağlayan Sözleşmesi · v${row.version}` : `Ruhsat formu · ${row.articleTitle ?? "—"}`}
                  </Td>
                  <Td className="text-xs">
                    <a href={`/api/media/${row.fileMediaId}`} className="text-accent underline">
                      PDF indir
                    </a>
                    {row.reviewedAt && <span className="block text-muted">doğrulandı {formatDateTime(row.reviewedAt)}</span>}
                  </Td>
                  <Td className="min-w-[16rem] text-xs">
                    {row.countersignedMediaId && (
                      <p className="mb-2">
                        <span className="text-accent">İmzalandı</span> · {row.countersignerName ?? "—"} ·{" "}
                        {row.countersignedAt && formatDateTime(row.countersignedAt)} ·{" "}
                        <a href={`/api/media/${row.countersignedMediaId}`} className="text-accent underline">
                          iki tarafça imzalı PDF
                        </a>
                      </p>
                    )}
                    <SignedContractUploadForm
                      action={uploadCountersignedAction}
                      csrfToken={csrfToken}
                      maxMb={MAX_SIGNED_CONTRACT_MB}
                      documentId={row.id}
                      fieldName="id"
                      label={row.countersignedMediaId ? "Yenisiyle değiştir" : "İki tarafça imzalı PDF"}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
