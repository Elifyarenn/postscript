import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { listForCountersign, MAX_SIGNED_CONTRACT_MB } from "@/services/signed-contracts";
import { listAwaitingUploads } from "@/services/contributor-documents";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionButton } from "@/components/form";
import { SignedContractUploadForm } from "@/components/signed-contract";
import { queueUploadRemindersAction, uploadCountersignedAction, uploadSignedContractForMemberAction } from "../../actions";

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
  const [items, awaiting] = await Promise.all([listForCountersign({ ...user }), listAwaitingUploads({ ...user })]);
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

      <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-serif text-lg">Belge yüklemesi bekleyenler ({awaiting.length})</h2>
        <p className="mb-4 text-sm text-muted">
          Hazır belgesi olup imzalı kopyasını henüz yüklemeyen (ya da yüklediği reddedilen) kişiler. Hatırlatma
          düğmeleri maili yalnızca kuyruğa alır; göndermek için{" "}
          <Link href="/admin/mail" className="text-accent underline">
            E-posta kuyruğu
          </Link>{" "}
          sayfasında &ldquo;Kuyruğu şimdi işle&rdquo;. Her basış yeni bir hatırlatma kuyruğa alır. Kişi imzalı PDF&rsquo;i
          başka yoldan (e-posta gibi) gönderdiyse belgenin altındaki &ldquo;Kişi adına yükle&rdquo; ile yükleyin; dosya
          inceleniyor olarak düşer ve her zamanki gibi doğrulanır. Yazar durumu &ldquo;Donduruldu&rdquo; olanlar bu listede yer almaz.
        </p>
        {awaiting.length === 0 ? (
          <EmptyState>Yüklemesi beklenen belge yok.</EmptyState>
        ) : (
          <>
            <div className="mb-3">
              <ActionButton
                action={queueUploadRemindersAction}
                csrfToken={csrfToken}
                label={`Hepsine hatırlatma maili kuyruğa al (${awaiting.length} kişi)`}
                fields={{ userId: "all" }}
                confirmMessage={`${awaiting.length} kişiye imzalı belge hatırlatması kuyruğa alınacak. Devam edilsin mi?`}
              />
            </div>
            <Table>
              <thead>
                <tr>
                  <Th>Katkı sağlayan</Th>
                  <Th>Yüklenmesi beklenen belgeler</Th>
                  <Th>Son hatırlatma</Th>
                  <Th>Hatırlat</Th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((entry) => (
                  <tr key={entry.userId}>
                    <Td className="text-xs">
                      <Link href={`/admin/users/${entry.userId}`} className="underline">
                        {entry.userName}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      <ul className="list-disc pl-4">
                        {entry.documents.map((document) => (
                          <li key={document.id} className="mb-2">
                            {document.label}
                            {document.rejected && <span className="text-danger"> (reddedildi, yeniden bekleniyor)</span>}
                            {/* For the member who signed but could not upload, e.g. from a phone (D-303) */}
                            <details className="mt-1">
                              <summary className="cursor-pointer text-accent underline">Kişi adına yükle</summary>
                              <div className="mt-2 min-w-[16rem]">
                                <SignedContractUploadForm
                                  action={uploadSignedContractForMemberAction}
                                  csrfToken={csrfToken}
                                  maxMb={MAX_SIGNED_CONTRACT_MB}
                                  documentId={document.id}
                                  label="Kişinin imzaladığı PDF"
                                />
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td className="text-xs">{entry.lastReminderAt ? formatDateTime(entry.lastReminderAt) : "—"}</Td>
                    <Td className="text-xs">
                      <ActionButton
                        action={queueUploadRemindersAction}
                        csrfToken={csrfToken}
                        label="Hatırlatma maili"
                        fields={{ userId: entry.userId }}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-serif text-lg">Doğrulanan imzalı belgeler</h2>
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
      </div>
    </>
  );
}
