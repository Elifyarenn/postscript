import { guardPanel } from "@/lib/auth/guard";
import { acceptanceReport, listAgreementVersions } from "@/services/agreements";
import { listSignedContracts } from "@/services/signed-contracts";
import { listContributorDocuments } from "@/services/contributor-documents";
import { listUnlicensedFormerWriterWorks } from "@/services/unlicensed-works";
import { DOCUMENT_KIND_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/contributor-documents";
import { documentPdfHref } from "@/components/contributor-documents";
import { getSiteSettings, PLACEHOLDER_BY_KEY, SETTING_LABELS } from "@/services/site-settings";
import { readAgreementTemplate, templateHash, TEMPLATE_FILE } from "@/lib/agreement/template";
import { extractPlaceholders } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { ActionButton, PanelForm } from "@/components/form";
import Link from "next/link";
import { Alert, Card, EmptyState, Field, PageHeader, StatusBadge, Table, Td, Textarea, Th } from "@/components/ui";
import { SIGNED_CONTRACT_STATUS_LABELS } from "@/components/signed-contract";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  approveSignedContractAction,
  clearContributorDocumentsAction,
  mailContributorDocumentsAction,
  queueAllContributorDocumentsAction,
  createVersionFromTemplateAction,
  prepareContributorDocumentsAction,
  publishAgreementAction,
  rejectSignedContractAction,
  removeUnlicensedFormerWriterWorksAction,
  replaceCurrentVersionTextAction,
} from "../actions";

export const metadata = { title: "Sözleşme sürümleri" };

/** Every placeholder the dictionary can fill, in the order §3 lists them. */
const KNOWN_PLACEHOLDERS = [
  "agreement.version",
  "agreement.published_at",
  "agreement.body_hash",
  "dergi.ortak_1",
  "dergi.ortak_2",
  "dergi.adres",
  "dergi.eposta",
  "dergi.domain",
  "dergi.sehir",
  "yazar.ad_soyad",
  "yazar.dogum_tarihi",
  "yazar.eposta",
  "yazar.mahlas",
  // The contributor contract's names for the same person (D-276)
  "katki.ad_soyad",
  "katki.rol",
  "katki.dogum_tarihi",
  "katki.eposta",
  "katki.mahlas",
  "kvkk.version",
  "acceptance.accepted_at",
  "acceptance.ip",
];

export default async function AdminAgreementsPage() {
  const { user } = await guardPanel("admin");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";

  const versions = await listAgreementVersions(actor);
  const report = await acceptanceReport(actor);
  const signed = await listSignedContracts(actor);
  const documents = await listContributorDocuments(actor);
  const unlicensed = await listUnlicensedFormerWriterWorks(actor);
  const reviewCount = documents.filter((row) => row.status === "needs_review").length;
  const preparedByUser = new Map<string, number>();
  for (const row of documents) {
    if (row.status === "prepared") preparedByUser.set(row.userId, (preparedByUser.get(row.userId) ?? 0) + 1);
  }
  // Waiting ones first; the rest stay listed as the record of what was decided
  const ordered = [...signed.filter((row) => row.status === "pending"), ...signed.filter((row) => row.status !== "pending")];
  const settings = await getSiteSettings();

  const template = readAgreementTemplate();
  const hash = templateHash();
  const used = extractPlaceholders(template);
  const unknown = used.filter((name) => !KNOWN_PLACEHOLDERS.includes(name));

  const alreadyVersioned = versions.some((version) => version.bodyHash === hash);
  const drafts = versions.filter((version) => version.publishedAt === null);
  const current = versions.find((version) => version.isCurrent) ?? null;

  // Which publisher details are still missing; without them nothing renders
  const missingSettings = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([key]) => key as keyof typeof SETTING_LABELS);

  return (
    <>
      <PageHeader
        title="Sözleşme sürümleri"
        description="Sözleşme metni depodaki şablon dosyasıdır. Metin değişikliği yeni sürüm demektir."
      />

      <div className="space-y-6">
        <Alert tone="warning" title="Yayınlamanın sonuçları">
          Yeni bir sürüm yayınlandığında bu sürüm güncel sözleşme olur. Önceki sürüm için
          doğrulanmış imzalı sözleşmeler yeni sürümü kapsamaz; üyeler yeni sürümü imzalayıp
          yükler (D-275).
        </Alert>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Şablon</h2>

          <dl className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Dosya</dt>
              <dd>
                <code>contracts/{TEMPLATE_FILE}</code>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Metin özeti (sha256)</dt>
              <dd className="font-mono text-[11px] break-all">{hash}</dd>
            </div>
          </dl>

          <h3 className="mb-2 text-sm font-medium">Yer tutucular ({used.length})</h3>
          <ul className="mb-5 flex flex-wrap gap-1.5">
            {used.map((name) => {
              const isKnown = KNOWN_PLACEHOLDERS.includes(name);
              return (
                <li
                  key={name}
                  className={
                    isKnown
                      ? "rounded border border-line bg-paper px-2 py-0.5 font-mono text-[11px] text-muted"
                      : "rounded border border-danger/40 bg-danger-soft px-2 py-0.5 font-mono text-[11px] text-danger"
                  }
                >
                  {name}
                </li>
              );
            })}
          </ul>

          {unknown.length > 0 ? (
            <Alert tone="danger" title="Sözlük dışı yer tutucu var">
              Şablon şu yer tutucuları kullanıyor ama sözlükte karşılıkları yok:{" "}
              {unknown.join(", ")}. Bu hâliyle yayınlanamaz.
            </Alert>
          ) : missingSettings.length > 0 ? (
            <Alert tone="warning" title="Yayıncı bilgileri eksik">
              <ul className="mt-1 list-disc pl-5">
                {missingSettings.map((key) => (
                  <li key={key}>
                    {SETTING_LABELS[key]} <code>({PLACEHOLDER_BY_KEY[key]})</code>
                  </li>
                ))}
              </ul>
              Sistem sayfasından doldurulmadan hiçbir sözleşme render edilemez.
            </Alert>
          ) : alreadyVersioned ? (
            <Alert tone="info">
              Bu şablon metni zaten bir sürüm olarak kayıtlı. Yeni sürüm için önce dosyayı
              değiştirin.
            </Alert>
          ) : current && !signed.some((row) => row.version === current.version) ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Güncel sürüm (v{current.version}) için henüz imzalı sözleşme yüklenmedi. Şablonun metni
                v{current.version}&apos;in metni olarak konabilir; sürüm numarası ve yayın tarihi aynı kalır, eski
                metin denetim kaydında saklanır (D-283).
              </p>
              <ActionButton
                action={replaceCurrentVersionTextAction}
                csrfToken={csrfToken}
                label={`Şablonu v${current.version} yap`}
                variant="primary"
                fields={{ versionId: current.id }}
                confirmMessage={`v${current.version}'in metni şablondaki Genel Katkı Sağlayan Sözleşmesi ile değiştirilecek. Eski metin denetim kaydında saklanır. Devam edilsin mi?`}
              />
            </div>
          ) : (
            <PanelForm
              action={createVersionFromTemplateAction}
              csrfToken={csrfToken}
              submitLabel="Şablondan sürüm oluştur"
            />
          )}
        </Card>

        {drafts.map((draft) => (
          <Card key={draft.id}>
            <h2 className="mb-1 font-serif text-lg">Taslak v{draft.version}</h2>
            <p className="mb-4 font-mono text-[11px] break-all text-muted">{draft.bodyHash}</p>

            <ActionButton
              action={publishAgreementAction}
              csrfToken={csrfToken}
              label="Bu sürümü yayınla"
              variant="primary"
              fields={{ versionId: draft.id }}
              confirmMessage="Bu sürüm yayınlanacak ve güncel sözleşme olacak. Devam edilsin mi?"
            />
          </Card>
        ))}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Sürümler</h2>

          {versions.length === 0 ? (
            <EmptyState>Henüz sürüm yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sürüm</Th>
                  <Th>Durum</Th>
                  <Th>Yayın</Th>
                  <Th>Şablon özeti</Th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <Td>v{version.version}</Td>
                    <Td className="text-xs">
                      {version.isCurrent ? (
                        <span className="text-accent">güncel</span>
                      ) : version.publishedAt ? (
                        "eski"
                      ) : (
                        "taslak"
                      )}
                    </Td>
                    <Td className="text-xs">{formatDate(version.publishedAt)}</Td>
                    <Td className="max-w-[12rem] truncate font-mono text-[10px]">
                      {version.bodyHash}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {unlicensed.length > 0 && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">
              Yazarlıktan çıkarılanların ruhsatsız eserleri ({unlicensed.length})
            </h2>
            <p className="mb-4 text-sm text-muted">
              Yazarı artık yazar rolünde olmayan ve imzalı ruhsat onayı hiç olmayan eserler. Kaldırılan
              eser sitede ve panelde görünmez olur; kaydı ve sürüm geçmişi saklanır. Bu eserler için
              hazırlanmış, gönderilmemiş belgeler de silinir. Yalnızca aşağıda listelenenler kaldırılır.
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Yazar</Th>
                  <Th>Eser</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {unlicensed.map((work) => (
                  <tr key={work.id}>
                    <Td className="text-xs">
                      <Link href={`/admin/users/${work.authorId}`} className="underline">
                        {work.authorName}
                      </Link>
                    </Td>
                    <Td className="text-xs">{work.title}</Td>
                    <Td className="text-xs">
                      <StatusBadge status={work.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-4">
              <ActionButton
                action={removeUnlicensedFormerWriterWorksAction}
                csrfToken={csrfToken}
                label={`Bu ${unlicensed.length} eseri kaldır`}
                variant="danger"
                fields={{ ids: unlicensed.map((work) => work.id).join(",") }}
                confirmMessage={`${unlicensed.length} eser siteden ve panelden kaldırılacak (yayımlanmış olanlar dahil). Kayıtları ve sürüm geçmişi saklanır. Devam edilsin mi?`}
              />
            </div>
          </Card>
        )}

        <Card>
          <h2 className="mb-1 font-serif text-lg">Katkı sağlayan belgeleri</h2>
          <p className="mb-4 text-sm text-muted">
            Güncel sürümün Genel Katkı Sağlayan Sözleşmesi her katkı sağlayana, Eser Bazlı Kullanım
            Ruhsatı Formu her esere (eserin yazarının hesabına) hazırlanır. Kayıtlarda olmayan ya da
            şüpheli bir bilgi tahminle doldurulmaz; belge &ldquo;İnceleme gerekiyor&rdquo; olarak nedeniyle
            kalır. Tekrar çalıştırmak yalnızca eksikleri ekler ve incelemedekileri yeniden dener; hazır
            belgelere dokunmaz. Hazırlamak e-posta göndermez; hazır belgeler yalnızca kişinin satırındaki
            &ldquo;Belgelerini mail gönder&rdquo; ile PDF ekiyle gönderilir.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <ActionButton
              action={prepareContributorDocumentsAction}
              csrfToken={csrfToken}
              label="Belgeleri hazırla (e-posta gönderilmez)"
              variant="primary"
              confirmMessage="Eksik sözleşme ve ruhsat belgeleri hazırlanacak. E-posta gönderilmez. Devam edilsin mi?"
            />
            {preparedByUser.size > 0 && (
              <ActionButton
                action={queueAllContributorDocumentsAction}
                csrfToken={csrfToken}
                label={`Hazır belgelerin hepsini mail kuyruğuna al (${preparedByUser.size} kişi)`}
                confirmMessage={`${preparedByUser.size} kişiye hazır belgeleri PDF ekiyle e-posta kuyruğuna yazılacak. Gönderim /admin/mail'de "Kuyruğu şimdi işle" ile yapılır. Devam edilsin mi?`}
              />
            )}
            {documents.length > 0 && (
              <ActionButton
                action={clearContributorDocumentsAction}
                csrfToken={csrfToken}
                label="Hazırlanan belgelerin hepsini sil"
                variant="danger"
                confirmMessage={`${documents.length} hazırlanmış belge silinecek (yüklenen imzalı sözleşmelere dokunulmaz). Sonra "Belgeleri hazırla" ile yeniden hazırlayabilirsiniz. Devam edilsin mi?`}
              />
            )}
          </div>

          {documents.length === 0 ? (
            <EmptyState>Henüz hazırlanmış belge yok.</EmptyState>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">
                {documents.length} belge · {reviewCount} inceleme gerekiyor
              </p>
              <Table>
                <thead>
                  <tr>
                    <Th>Katkı sağlayan</Th>
                    <Th>Belge</Th>
                    <Th>Eser</Th>
                    <Th>Durum</Th>
                    <Th>PDF</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((row, index) => (
                    <tr key={row.id}>
                      <Td className="text-xs">
                        <Link href={`/admin/users/${row.userId}`} className="underline">
                          {row.userName}
                        </Link>
                        <span className="block">
                          <StatusBadge status={row.userRole} />
                        </span>
                        {/* One button per person, on their first row; mail goes only on this click */}
                        {documents[index - 1]?.userId !== row.userId && (preparedByUser.get(row.userId) ?? 0) > 0 && (
                          <span className="mt-1 block">
                            <ActionButton
                              action={mailContributorDocumentsAction}
                              csrfToken={csrfToken}
                              label={`Belgelerini mail gönder (${preparedByUser.get(row.userId)})`}
                              fields={{ userId: row.userId }}
                              confirmMessage={`${row.userName} adlı kullanıcıya ${preparedByUser.get(row.userId)} hazır belge PDF ekiyle e-postayla gönderilecek. Devam edilsin mi?`}
                            />
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs">
                        <Link href={`/admin/agreements/documents/${row.id}`} className="text-accent underline">
                          {DOCUMENT_KIND_LABELS[row.kind]}
                        </Link>
                        {row.kind === "general_agreement" && <span className="text-muted"> · v{row.templateVersion}</span>}
                        <span className="block text-muted">Metni görmek için tıklayın</span>
                      </Td>
                      <Td className="text-xs">
                        {row.articleTitle ?? "—"}
                        {row.articleId && <span className="block font-mono text-[10px] text-muted">{row.articleId}</span>}
                      </Td>
                      <Td className="text-xs">
                        {DOCUMENT_STATUS_LABELS[row.status]}
                        {row.reviewReasons.length > 0 && (
                          <ul className="mt-1 list-disc pl-4 text-muted">
                            {row.reviewReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {row.status === "prepared" ? (
                          <a href={documentPdfHref(row.id)} className="text-accent underline">
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
            </>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">İmzalı sözleşme doğrulaması</h2>
          <p className="mb-4 text-sm text-muted">
            Üyelerin yüklediği imzalı PDF&apos;ler. Dosyayı açıp kontrol edin; doğrulamak ya da nedenini
            yazarak reddetmek sizin işinizdir. Kendi yüklediğiniz dosyayı diğer yönetici doğrular.
          </p>

          {ordered.length === 0 ? (
            <EmptyState>Henüz yüklenmiş imzalı sözleşme yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Üye</Th>
                  <Th>Rol</Th>
                  <Th>Yükleme</Th>
                  <Th>Belge</Th>
                  <Th>Durum</Th>
                  <Th>İşlem</Th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/admin/users/${row.memberId}`} className="underline">
                        {row.memberName}
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={row.memberRole} />
                    </Td>
                    <Td className="text-xs">{formatDateTime(row.uploadedAt)}</Td>
                    <Td className="text-xs">
                      {row.isContract ? `Genel sözleşme · v${row.version}` : `Ruhsat formu · ${row.articleTitle ?? "—"}`}
                      {!row.isCurrentVersion && <span className="text-muted"> (eski sürüm)</span>}
                    </Td>
                    <Td className="text-xs">
                      {SIGNED_CONTRACT_STATUS_LABELS[row.status]}
                      {row.reviewedAt && (
                        <span className="block text-muted">
                          {row.reviewerName ?? "—"} · {formatDateTime(row.reviewedAt)}
                        </span>
                      )}
                      {row.rejectionReason && <span className="block">Neden: {row.rejectionReason}</span>}
                    </Td>
                    <Td className="space-y-2 text-xs">
                      <Link href={`/api/media/${row.fileMediaId}`} className="text-accent underline">
                        PDF&apos;yi aç / indir
                      </Link>
                      {row.status === "pending" && row.memberId !== actor.id && (
                        <div className="space-y-2">
                          <ActionButton
                            action={approveSignedContractAction}
                            csrfToken={csrfToken}
                            label="Doğrula"
                            variant="primary"
                            fields={{ id: row.id }}
                            confirmMessage="Bu PDF'yi kontrol ettiniz ve imzalı sözleşme olarak doğruluyorsunuz. Devam edilsin mi?"
                          />
                          <PanelForm
                            action={rejectSignedContractAction}
                            csrfToken={csrfToken}
                            submitLabel="Reddet"
                            submitVariant="danger"
                          >
                            <input type="hidden" name="id" value={row.id} />
                            <Field label="Ret nedeni (üye görür)" htmlFor={`reason-${row.id}`}>
                              <Textarea id={`reason-${row.id}`} name="reason" required minLength={3} maxLength={1000} rows={2} />
                            </Field>
                          </PanelForm>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Doğrulama raporu (güncel sürüm)</h2>

          {report.current === null ? (
            <EmptyState>Yayınlanmış sürüm yok.</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-medium">
                  Doğrulananlar ({report.accepted.length})
                </h3>
                {report.accepted.length === 0 ? (
                  <p className="text-sm text-muted">Henüz doğrulanan sözleşme yok.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {report.accepted.map((row) => (
                      <li key={row.id} className="flex justify-between gap-3">
                        <span>{row.displayName}</span>
                        <span className="text-xs text-muted">{formatDateTime(row.acceptedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium">Bekleyenler ({report.pending.length})</h3>
                {report.pending.length === 0 ? (
                  <p className="text-sm text-muted">Bekleyen yazar yok.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {report.pending.map((row) => (
                      <li key={row.id}>{row.displayName}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
