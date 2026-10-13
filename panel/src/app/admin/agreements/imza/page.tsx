import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import {
  countPendingVerifications,
  listForCountersign,
  MAX_SIGNED_CONTRACT_MB,
  type CountersignItem,
} from "@/services/signed-contracts";
import { listAwaitingUploads, type AwaitingUpload } from "@/services/contributor-documents";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { ActionButton } from "@/components/form";
import { SignedContractUploadForm } from "@/components/signed-contract";
import { queueUploadRemindersAction, uploadCountersignedAction, uploadSignedContractForMemberAction } from "../../actions";

export const metadata = { title: "İmzalı sözleşme arşivi" };

// Verifications and signatures change from minute to minute
export const dynamic = "force-dynamic";

/**
 * Where every contributor stands on their documents (D-335): who has not
 * signed, whose upload waits for verification, which verified documents lack
 * the magazine-signed copy, which are signed by both sides, and who left the
 * magazine. The magazine-signed copy is for the archive only: the admin's
 * verification alone makes the contract count (D-334).
 */
export default async function CountersignPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const [items, awaiting, formerAwaiting, pending] = await Promise.all([
    listForCountersign({ ...user }, { includeFormer: true }),
    listAwaitingUploads({ ...user }),
    listAwaitingUploads({ ...user }, { former: true }),
    countPendingVerifications({ ...user }),
  ]);
  const current = items.filter((row) => !row.former);
  const withoutMagazine = current.filter((row) => !row.countersignedMediaId);
  const bothSigned = current.filter((row) => row.countersignedMediaId);
  const formerSigned = items.filter((row) => row.former);
  const formerPeople = new Set([...formerSigned.map((row) => row.memberId), ...formerAwaiting.map((entry) => entry.userId)]);
  const unsignedDocuments = awaiting.reduce((sum, entry) => sum + entry.documents.length, 0);

  const tiles = [
    { href: "#imzalamayanlar", label: "İmzalamayan", value: `${awaiting.length} kişi`, note: `${unsignedDocuments} belge` },
    { href: "#inceleniyor", label: "Doğrulama bekleyen", value: `${pending} belge`, note: "yüklendi, inceleniyor" },
    { href: "#dergi-imzasi-yok", label: "Dergi imzalı yüklenmemiş", value: `${withoutMagazine.length} belge`, note: "katkı sağlayan imzaladı" },
    { href: "#iki-tarafli", label: "İki tarafça imzalı", value: `${bothSigned.length} belge`, note: "arşivde" },
    { href: "#ayrilanlar", label: "Dergiden ayrılan", value: `${formerPeople.size} kişi`, note: "belgeleri ayrı listede" },
  ];

  return (
    <>
      <PageHeader
        title="İmzalı sözleşme arşivi"
        description="Herkesin belge durumu tek yerde. Doğruladığınız sözleşme onaylanmış sayılır; dergi imzalı (iki tarafça imzalı) PDF yalnızca arşiv içindir, yüklenmemesi hiçbir işlemi engellemez."
        actions={
          <Link href="/admin/agreements" className="text-sm text-accent underline">
            Sözleşme sürümleri
          </Link>
        }
      />

      <div className="space-y-6">
        <nav aria-label="Özet" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => (
            <a key={tile.href} href={tile.href} className="rounded-md border border-line p-3 hover:border-accent">
              <span className="block text-xs text-muted">{tile.label}</span>
              <span className="block font-serif text-lg">{tile.value}</span>
              <span className="block text-xs text-muted">{tile.note}</span>
            </a>
          ))}
        </nav>

        <Card id="imzalamayanlar">
          <h2 className="mb-1 font-serif text-lg">İmzalamayanlar ({awaiting.length} kişi)</h2>
          <p className="mb-4 text-sm text-muted">
            Hazır belgesi gönderilmiş, imzalı kopyasını henüz yüklemeyen (ya da yüklediği reddedilen) kişiler. Hatırlatma
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

        <Card id="inceleniyor">
          <h2 className="mb-1 font-serif text-lg">Doğrulama bekleyenler ({pending} belge)</h2>
          <p className="text-sm text-muted">
            Katkı sağlayanın yüklediği, henüz doğrulanmamış imzalı PDF&rsquo;ler.{" "}
            <Link href="/admin/agreements" className="text-accent underline">
              Sözleşme sürümleri
            </Link>{" "}
            sayfasındaki &ldquo;İmzalı sözleşme doğrulaması&rdquo; listesinden doğrulayın ya da reddedin.
          </p>
        </Card>

        <Card id="dergi-imzasi-yok">
          <h2 className="mb-1 font-serif text-lg">Dergi imzalı yüklenmeyen belgeler ({withoutMagazine.length})</h2>
          <p className="mb-4 text-sm text-muted">
            Katkı sağlayanın imzaladığı ve sizin doğruladığınız, dergi imzalı (iki tarafça imzalı) kopyası henüz yüklenmemiş
            belgeler. Sözleşme zaten onaylı; bu kopya arşiv içindir.
          </p>
          {withoutMagazine.length > 0 && (
            <div className="mb-4 text-sm">
              <a href="/api/admin/signed-contracts/zip" className="rounded-md border border-line px-3 py-1.5 text-accent underline">
                Hepsini indir (ZIP)
              </a>
            </div>
          )}
          <SignedTable rows={withoutMagazine} csrfToken={csrfToken} empty="Dergi imzalı kopyası eksik belge yok." />
        </Card>

        <Card id="iki-tarafli">
          <h2 className="mb-1 font-serif text-lg">İki tarafça imzalı belgeler ({bothSigned.length})</h2>
          <p className="mb-4 text-sm text-muted">
            Dergi imzalı kopyası yüklenmiş belgeler.{" "}
            {items.length > 0 && (
              <a href="/api/admin/signed-contracts/zip?which=all" className="text-accent underline">
                Doğrulanmış bütün belgeleri indir (ZIP, ayrılanlar dahil)
              </a>
            )}
          </p>
          <SignedTable rows={bothSigned} csrfToken={csrfToken} empty="Henüz iki tarafça imzalı belge yok." />
        </Card>

        <Card id="ayrilanlar">
          <h2 className="mb-1 font-serif text-lg">Dergiden ayrılanlar ({formerPeople.size} kişi)</h2>
          <p className="mb-4 text-sm text-muted">
            Artık katkı vermeyenler: yazarlıktan okura döndürülenler (tasarımcı işareti ve onaylı başvurusu da olmayanlar).
            Üstteki listelere ve hatırlatmalara girmezler; imzaladıkları belgeler hukuki kayıt olarak burada durur.
          </p>
          <h3 className="mb-2 text-sm font-medium">İmzaladıkları ve doğrulanan belgeler ({formerSigned.length})</h3>
          <SignedTable rows={formerSigned} csrfToken={csrfToken} empty="Ayrılanlardan doğrulanmış belge yok." />
          <h3 className="mb-2 mt-6 text-sm font-medium">İmzalamadıkları belgeler ({formerAwaiting.length} kişi)</h3>
          <FormerUnsigned entries={formerAwaiting} />
        </Card>
      </div>
    </>
  );
}

function SignedTable({ rows, csrfToken, empty }: { rows: CountersignItem[]; csrfToken: string; empty: string }) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Katkı sağlayan</Th>
          <Th>Belge</Th>
          <Th>Katkı sağlayanın imzası</Th>
          <Th>Dergi imzalı kopya</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
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
              {row.countersignedMediaId ? (
                <p className="mb-2">
                  <span className="text-accent">Yüklendi</span> · {row.countersignerName ?? "—"} ·{" "}
                  {row.countersignedAt && formatDateTime(row.countersignedAt)} ·{" "}
                  <a href={`/api/media/${row.countersignedMediaId}`} className="text-accent underline">
                    iki tarafça imzalı PDF
                  </a>
                </p>
              ) : (
                <p className="mb-2 text-warning">Yüklenmedi</p>
              )}
              <SignedContractUploadForm
                action={uploadCountersignedAction}
                csrfToken={csrfToken}
                maxMb={MAX_SIGNED_CONTRACT_MB}
                documentId={row.id}
                fieldName="id"
                label={row.countersignedMediaId ? "Yenisiyle değiştir" : "Dergi imzalı PDF"}
              />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function FormerUnsigned({ entries }: { entries: AwaitingUpload[] }) {
  if (entries.length === 0) return <EmptyState>Ayrılanlardan imzalanmamış belge yok.</EmptyState>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Kişi</Th>
          <Th>İmzalanmamış belgeler</Th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.userId}>
            <Td className="text-xs">
              <Link href={`/admin/users/${entry.userId}`} className="underline">
                {entry.userName}
              </Link>
            </Td>
            <Td className="text-xs">
              <ul className="list-disc pl-4">
                {entry.documents.map((document) => (
                  <li key={document.id}>
                    {document.label}
                    {document.rejected && <span className="text-danger"> (reddedildi)</span>}
                    {document.pending && <span className="text-warning"> (yüklendi, inceleniyor)</span>}
                  </li>
                ))}
              </ul>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
