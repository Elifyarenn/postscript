import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { roleChanges, users, type User } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { panelRoleBadges } from "@/lib/auth/rbac";
import { isAppError } from "@/lib/errors";
import { checkPromotionReadiness, findUserById, getUserOverview } from "@/services/users";
import { calculateAge } from "@/lib/age";
import { whatsappHref } from "@/lib/whatsapp";
import { profileHref } from "@/lib/profile-link";
import { renderAgreementForWriter } from "@/services/agreements";
import { listAllWriterAreasWithQuota } from "@/services/writer-areas";
import { listGrantableIssues, listIssueGrantsForUser } from "@/services/issue-grants";
import { listAreaGrantableIssues, listIssueAreaGrantsForUser } from "@/services/issue-area-grants";
import { listEditorAreasWithHolders, listEditorCategories } from "@/services/editor-categories";
import { AgreementRenderError } from "@/lib/agreement/render";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { ActionButton, PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  changeRoleAction,
  grantIssueSubmissionAction,
  revokeIssueSubmissionAction,
  grantIssueAreaAction,
  revokeIssueAreaAction,
  deleteUserAction,
  promoteToWriterAction,
  revokeUserSessionsAction,
  setBannedAction,
  setBirthDateAction,
  setEditorDutiesAction,
  setEditorStatusAction,
  setHybridWriterRoleAction,
  setIllustratorAction,
  setAuthorizedAction,
  setWriterAreasAction,
  setWriterStatusAction,
} from "../../actions";

export const metadata = { title: "Kullanıcı" };

/** The precondition list §9 asks for: every rule with a tick or a cross. */
const RULES = [
  { id: "email_not_verified", label: "E-posta adresi doğrulanmış" },
  { id: "birth_date_missing", label: "Doğum tarihi girilmiş" },
  { id: "under_age", label: "18 yaşını doldurmuş" },
  { id: "banned", label: "Yasaklı değil" },
] as const;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await guardPanel("admin");
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  // A deleted (or otherwise missing) account has no detail page; a real 404
  // keeps a stale link or a back button from turning into a 500.
  let target: User;
  try {
    target = await findUserById(id);
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }
  const readiness = await checkPromotionReadiness(target);
  const areas = await listAllWriterAreasWithQuota();

  // Editor duty data: the areas this editor already holds and every area with
  // its current holder, so the form can disable areas owned by others.
  const editorDuties =
    target.role === "editor" ? await listEditorCategories(id) : [];
  const editorAreas =
    target.role === "editor" ? await listEditorAreasWithHolders() : [];
  const areaIdBySlot = new Map(editorDuties.map((duty) => [duty.slot, duty.areaId]));
  const hybrid = target.role === "editor" && target.writerStatus !== null;

  const overview = await getUserOverview({ ...user }, id);
  // A writer can be let into an issue that is closed to new articles (D-296)
  const writes = target.writerStatus !== null && target.role !== "user";
  const [issueGrants, grantableIssues] = writes
    ? await Promise.all([listIssueGrantsForUser({ ...user }, id), listGrantableIssues({ ...user })])
    : [[], []];
  const openIssues = grantableIssues.filter((issue) => !issueGrants.some((grant) => grant.issueId === issue.id));
  // An area for one issue only (D-306); an admin already writes in every area
  const takesTemporaryAreas = writes && target.role !== "admin";
  const [areaGrants, areaIssues] = takesTemporaryAreas
    ? await Promise.all([listIssueAreaGrantsForUser({ ...user }, id), listAreaGrantableIssues({ ...user })])
    : [[], []];
  const temporaryAreaChoices = areas.filter(
    (area) => area.isActive && area.name !== target.writerArea && area.name !== target.writerArea2,
  );
  const age = target.birthDate ? calculateAge(target.birthDate) : null;

  // The info card shows what this kind of account actually carries (D-087):
  // consent and the application for a reader, areas and output for a writer,
  // duties for an editor, the second factor for staff
  const href = profileHref(target);
  const phoneHref = whatsappHref(target.phone);

  const details: { label: string; value: ReactNode }[] = [
    { label: "E-posta", value: target.email },
    {
      label: "Profil",
      value: href ? (
        <Link href={href} className="underline">
          {target.penName && target.penNameSlug ? target.penName : `@${target.username}`}
        </Link>
      ) : (
        "Yok"
      ),
    },
    {
      label: "Kullanıcı adı",
      value: target.username ? (
        <Link href={`/social/u/${target.username}`} className="underline">@{target.username}</Link>
      ) : (
        "—"
      ),
    },
    {
      label: "E-posta doğrulama",
      value: target.emailVerifiedAt ? formatDateTime(target.emailVerifiedAt) : "Doğrulanmadı",
    },
    {
      label: "Telefon",
      // The number opens the chat; a number too broken to read stays plain text (D-231)
      value: phoneHref ? (
        <a href={phoneHref} target="_blank" rel="noopener noreferrer" className="underline">
          {target.phone}
        </a>
      ) : (
        (target.phone ?? "—")
      ),
    },
    {
      label: "Doğum tarihi",
      value: target.birthDate
        ? `${formatDate(target.birthDate)}${age !== null ? ` (${age} yaş)` : ""}`
        : "—",
    },
    ...(target.role === "user"
      ? [
          {
            label: "KVKK onayı",
            value: target.kvkkConsentAt
              ? `v${target.kvkkConsentVersion ?? "?"} · ${formatDateTime(target.kvkkConsentAt)}`
              : "—",
          },
          {
            label: "Yazar başvurusu",
            value: overview.applicationStatus ? (
              <StatusBadge status={overview.applicationStatus} />
            ) : (
              "Yok"
            ),
          },
        ]
      : []),
    ...(target.role === "writer" || hybrid
      ? [
          {
            label: "Mahlas",
            value:
              target.penName && target.penNameSlug ? (
                <Link href={`/magazine/authors/${target.penNameSlug}`} className="underline">
                  {target.penName}
                </Link>
              ) : (
                (target.penName ?? "—")
              ),
          },
          { label: "Alan", value: target.writerArea ?? "—" },
          { label: "2. alan", value: target.writerArea2 ?? "—" },
          {
            label: "Yazılar",
            value: `${overview.articleCount} (${overview.publishedCount} yayında)`,
          },
        ]
      : []),
    ...(target.role === "editor"
      ? [
          {
            label: "Sorumlu alanlar",
            value: overview.editorAreas.length > 0 ? overview.editorAreas.join(" · ") : "—",
          },
          { label: "Ana editör", value: target.isMainEditor ? "Evet" : "Hayır" },
        ]
      : []),
    ...(target.role === "editor" || target.role === "admin"
      ? [
          {
            label: "İki adımlı doğrulama",
            value: target.totpEnabledAt ? "Açık" : "Kapalı — kurulana kadar panele giremez",
          },
        ]
      : []),
    { label: "Kayıt", value: formatDateTime(target.createdAt) },
  ];

  // §9: the admin may look at the filled contract before promoting. This
  // preview is never stored; it exists only to be read.
  let preview: { html: string; hash: string } | { error: string } | null = null;
  if (target.role === "user") {
    try {
      const rendered = await renderAgreementForWriter(target);
      preview = { html: await renderMarkdown(rendered.markdown), hash: rendered.hash };
    } catch (error) {
      preview = {
        error:
          error instanceof AgreementRenderError
            ? error.message
            : "Sözleşme render edilemedi.",
      };
    }
  }

  const history = await db
    .select({
      id: roleChanges.id,
      oldRole: roleChanges.oldRole,
      newRole: roleChanges.newRole,
      note: roleChanges.note,
      createdAt: roleChanges.createdAt,
      changedByName: users.displayName,
    })
    .from(roleChanges)
    .leftJoin(users, eq(roleChanges.changedBy, users.id))
    .where(eq(roleChanges.userId, id))
    .orderBy(desc(roleChanges.createdAt));

  return (
    <>
      <PageHeader
        title={target.displayName}
        description={target.email}
        actions={
          <>
            {panelRoleBadges(target).map((badge) => (
              <StatusBadge key={badge} status={badge} />
            ))}
            {target.role !== "editor" && target.writerStatus && <StatusBadge status={target.writerStatus} />}
            {/* A designer with no team role already wears the tag above */}
            {target.isIllustrator && target.role !== "user" && <StatusBadge status="illustrator" />}
            {target.isAuthorized && <StatusBadge status="authorized" />}
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Kayıt bilgileri</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="text-muted">{detail.label}</dt>
                <dd className="text-ink">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Tasarımcı</h2>
          <p className="mb-4 text-sm text-muted">
            Tasarımcı (çizer dahil), dergiye görsel üreten hesaptır. Ayrı bir rol değildir:
            hesabın rolü değişmez, bu yüzden bir yazar aynı zamanda tasarımcı olabilir. İşaret
            kendi başına hiçbir panele giriş vermez; yalnızca Tasarımcılar listesinde ve Hakkında
            sayfasında görünür.
          </p>
          <PanelForm
            action={setIllustratorAction}
            csrfToken={csrfToken}
            submitLabel={target.isIllustrator ? "Tasarımcı işaretini kaldır" : "Tasarımcı olarak işaretle"}
            submitVariant="secondary"
          >
            <>
              <input type="hidden" name="userId" value={target.id} />
              <input
                type="hidden"
                name="illustrator"
                value={target.isIllustrator ? "hayir" : "evet"}
              />
              <p className="text-sm">
                Şu an: {target.isIllustrator ? "Tasarımcı olarak işaretli." : "Tasarımcı değil."}
              </p>
            </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">Yetkili</h2>
          <p className="mb-4 text-sm text-muted">
            Dergi adına yetkili hesabı işaretler. Tasarımcı işareti gibi ayrı bir rol değildir:
            hesabın rolü değişmez, hiçbir panele giriş vermez ve içerik üzerinde yetki
            tanımaz. İşaretli hesap Yetkililer listesinde ve ekipte görünür.
          </p>
          <PanelForm
            action={setAuthorizedAction}
            csrfToken={csrfToken}
            submitLabel={target.isAuthorized ? "Yetkili işaretini kaldır" : "Yetkili olarak işaretle"}
            submitVariant="secondary"
          >
            <>
              <input type="hidden" name="userId" value={target.id} />
              <input type="hidden" name="authorized" value={target.isAuthorized ? "hayir" : "evet"} />
              <p className="text-sm">
                Şu an: {target.isAuthorized ? "Yetkili olarak işaretli." : "Yetkili değil."}
              </p>
            </>
          </PanelForm>
        </Card>

        {writes && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Sayıya yazı gönderme izni</h2>
            <p className="mb-4 text-sm text-muted">
              Yeni yazıya kapalı bir sayıyı (yalnızca adminlere açık çalışma sayısı ya da planlaması
              bitmiş sayı) yalnızca bu yazara açar. İzin verildiği anda yazara e-posta gider. Dönemi
              olan sayılarda izin verilmez; orada konu ve yazı kabul dönemleri geçerlidir. Sözleşme,
              alan ve inceleme kuralları değişmez.
            </p>
            {issueGrants.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {issueGrants.map((grant) => (
                  <li key={grant.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      Sayı {grant.issueNumber} · {grant.issueTitle}
                      <span className="text-muted"> · {formatDateTime(grant.createdAt)}</span>
                    </span>
                    <ActionButton
                      action={revokeIssueSubmissionAction}
                      csrfToken={csrfToken}
                      label="İzni geri al"
                      variant="ghost"
                      fields={{ grantId: grant.id, userId: target.id }}
                      confirmMessage="Bu sayı için yazı gönderme izni geri alınsın mı? Başlatılmış yazılar yerinde kalır."
                    />
                  </li>
                ))}
              </ul>
            )}
            {openIssues.length === 0 ? (
              <p className="text-sm text-muted">İzin verilebilecek başka sayı yok.</p>
            ) : (
              <PanelForm
                action={grantIssueSubmissionAction}
                csrfToken={csrfToken}
                submitLabel="İzin ver ve e-posta gönder"
                submitVariant="secondary"
              >
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  <Field label="Sayı" htmlFor="grant-issue">
                    <Select id="grant-issue" name="issueId" required defaultValue="">
                      <option value="" disabled>
                        Seçin…
                      </option>
                      {openIssues.map((issue) => (
                        <option key={issue.id} value={issue.id}>
                          Sayı {issue.number} · {issue.title || "(başlıksız)"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              </PanelForm>
            )}
          </Card>
        )}

        {takesTemporaryAreas && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Geçici alan (sayıya özel)</h2>
            <p className="mb-4 text-sm text-muted">
              Yazara, kendi alanı olmayan bir alanı yalnızca seçtiğiniz sayı için verir. Yazar o
              sayıda bu alanda konu önerebilir ve yazı yazabilir; başka sayılarda göremez. Kendi
              alanları ve alan kotası değişmez. Verildiği anda yazara e-posta gider.
            </p>
            {areaGrants.length > 0 && (
              <ul className="mb-4 space-y-2 text-sm">
                {areaGrants.map((grant) => (
                  <li key={grant.id} className="flex flex-wrap items-center gap-3">
                    <span>
                      Sayı {grant.issueNumber} · {grant.issueTitle} — <strong>{grant.areaName}</strong>
                      <span className="text-muted"> · {formatDateTime(grant.createdAt)}</span>
                    </span>
                    <ActionButton
                      action={revokeIssueAreaAction}
                      csrfToken={csrfToken}
                      label="Geri al"
                      variant="ghost"
                      fields={{ grantId: grant.id, userId: target.id }}
                      confirmMessage="Bu geçici alan geri alınsın mı? O alanda açılmış konu ve yazılar yerinde kalır."
                    />
                  </li>
                ))}
              </ul>
            )}
            {areaIssues.length === 0 || temporaryAreaChoices.length === 0 ? (
              <p className="text-sm text-muted">Geçici alan verilebilecek sayı ya da alan yok.</p>
            ) : (
              <PanelForm
                action={grantIssueAreaAction}
                csrfToken={csrfToken}
                submitLabel="Geçici alanı ver ve e-posta gönder"
                submitVariant="secondary"
              >
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Sayı" htmlFor="area-grant-issue">
                      <Select id="area-grant-issue" name="issueId" required defaultValue="">
                        <option value="" disabled>
                          Seçin…
                        </option>
                        {areaIssues.map((issue) => (
                          <option key={issue.id} value={issue.id}>
                            Sayı {issue.number} · {issue.title || "(başlıksız)"}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Alan" htmlFor="area-grant-area">
                      <Select id="area-grant-area" name="areaId" required defaultValue="">
                        <option value="" disabled>
                          Seçin…
                        </option>
                        {temporaryAreaChoices.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                </>
              </PanelForm>
            )}
          </Card>
        )}

        {target.role === "writer" && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Yazar alanları</h2>
            <p className="mb-4 text-sm text-muted">
              Yalnızca yönetici değiştirebilir; yazar kendi alanlarını kendisi
              düzenleyemez. Bir yazar en fazla iki alanda yer alır ve dolu bir
              alan seçilemez.
            </p>
            <PanelForm
              action={setWriterAreasAction}
              csrfToken={csrfToken}
              submitLabel="Alanları güncelle"
              submitVariant="secondary"
            >
              <>
                <input type="hidden" name="userId" value={target.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="1. alan" htmlFor="area">
                    <Select id="area" name="area" defaultValue={target.writerArea ?? ""}>
                      <option value="">Yok</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.name}>
                          {area.name} ({area.currentCount}/{area.quota})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="2. alan"
                    htmlFor="area2"
                    hint="Boş bırakılırsa yazar tek alanda kalır."
                  >
                    <Select id="area2" name="area2" defaultValue={target.writerArea2 ?? ""}>
                      <option value="">Yok</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.name}>
                          {area.name} ({area.currentCount}/{area.quota})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            </PanelForm>
          </Card>
        )}

        {target.role === "editor" && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Editör görevleri</h2>
            <p className="mb-4 text-sm text-muted">
              Bir editör en fazla iki alandan sorumlu olabilir (1. alan ve 2.
              alan); bir alanın yalnızca bir editörü olur. Başka bir editörün
              sahiplendiği alan seçilemez. Ana editör tüm kategorileri okur ve
              ikinci onay aşamasını yürütür.
            </p>

            <PanelForm
              action={setEditorDutiesAction}
              csrfToken={csrfToken}
              submitLabel="Görevleri güncelle"
              submitVariant="secondary"
            >
              <>
                <input type="hidden" name="userId" value={target.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="1. alan" htmlFor="editorAreaId">
                    <Select
                      id="editorAreaId"
                      name="areaId"
                      defaultValue={areaIdBySlot.get(1) ?? ""}
                    >
                      <option value="">Yok</option>
                      {editorAreas.map((area) => (
                        <option
                          key={area.id}
                          value={area.id}
                          disabled={
                            area.holderEditorId !== null && area.holderEditorId !== target.id
                          }
                        >
                          {area.name}
                          {area.holderEditorName
                            ? ` (${area.holderEditorName})`
                            : area.isActive
                              ? ""
                              : " — devre dışı"}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="2. alan"
                    htmlFor="editorAreaId2"
                    hint="Boş bırakılırsa editör tek alanda kalır."
                  >
                    <Select
                      id="editorAreaId2"
                      name="areaId2"
                      defaultValue={areaIdBySlot.get(2) ?? ""}
                    >
                      <option value="">Yok</option>
                      {editorAreas.map((area) => (
                        <option
                          key={area.id}
                          value={area.id}
                          disabled={
                            area.holderEditorId !== null && area.holderEditorId !== target.id
                          }
                        >
                          {area.name}
                          {area.holderEditorName
                            ? ` (${area.holderEditorName})`
                            : area.isActive
                              ? ""
                              : " — devre dışı"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isMainEditor"
                    defaultChecked={target.isMainEditor}
                    className="mt-0.5 size-4 rounded border-line"
                  />
                  Ana editör — tüm kategorileri okur, kategori editöründen gelen
                  yazıyı onaylar.
                </label>
              </>
            </PanelForm>

            <div className="mt-5 border-t border-line pt-4">
              <PanelForm
                action={setHybridWriterRoleAction}
                csrfToken={csrfToken}
                submitLabel={hybrid ? "Yazarlığı kaldır" : "Yazar yap"}
                submitVariant={hybrid ? "secondary" : "primary"}
              >
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={hybrid}
                      className="mt-0.5 size-4 rounded border-line"
                    />
                    Aynı zamanda yazar — unvanı &ldquo;Editor &amp; Yazar&rdquo;
                    olur ve panel anahtarıyla iki panel arasında geçiş yapabilir.
                  </label>
                </>
              </PanelForm>
            </div>
          </Card>
        )}

        {target.isBanned && (
          <Alert tone="danger" title="Bu hesap yasaklı">
            Gerekçe: {target.bannedReason ?? "—"}
          </Alert>
        )}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Yazar terfisi</h2>

          {target.role !== "user" ? (
            <Alert tone="info">Bu kullanıcı zaten &ldquo;{target.role}&rdquo; rolünde.</Alert>
          ) : (
            <>
              <ul className="mb-5 space-y-2 text-sm">
                {RULES.map((rule) => {
                  const failed = readiness.problems.includes(rule.id);
                  return (
                    <li key={rule.id} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={
                          failed
                            ? "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-danger bg-danger-soft text-[10px] leading-none text-danger"
                            : "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-accent bg-accent text-[10px] leading-none text-white"
                        }
                      >
                        {failed ? "✗" : "✓"}
                      </span>
                      <span className={failed ? "text-danger" : "text-ink"}>
                        {rule.label}
                        <span className="sr-only">{failed ? " — sağlanmadı" : " — sağlandı"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              {readiness.eligible ? (
                <PanelForm
                  action={promoteToWriterAction}
                  csrfToken={csrfToken}
                  submitLabel="Yazar yap"
                >
                  <input type="hidden" name="userId" value={target.id} />
                  <Field label="Not" htmlFor="note" hint="Rol değişikliği kaydına yazılır.">
                    <Input id="note" name="note" />
                  </Field>
                </PanelForm>
              ) : (
                <Alert tone="warning" title="Ön koşullar sağlanmıyor">
                  <ul className="mt-1 list-disc pl-5">
                    {readiness.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </Alert>
              )}
            </>
          )}
        </Card>

        {preview && (
          <Card>
            <h2 className="mb-1 font-serif text-lg">Sözleşme önizlemesi</h2>
            <p className="mb-4 text-sm text-muted">
              Bu kullanıcının verileriyle doldurulmuş hâli. Önizleme kaydedilmez.
            </p>

            {"error" in preview ? (
              <Alert tone="danger">{preview.error}</Alert>
            ) : (
              <>
                <p className="mb-3 font-mono text-[11px] break-all text-muted">{preview.hash}</p>
                <div
                  className="prose-panel max-h-[26rem] overflow-y-auto rounded-md border border-line bg-paper p-5 text-sm"
                  dangerouslySetInnerHTML={{ __html: preview.html }}
                />
              </>
            )}
          </Card>
        )}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Rol ve durum</h2>

          <div className="grid gap-6 lg:grid-cols-2">
            <PanelForm
              action={changeRoleAction}
              csrfToken={csrfToken}
              submitLabel="Rolü değiştir"
              submitVariant="secondary"
            >
              <input type="hidden" name="userId" value={target.id} />
              <Field label="Rol" htmlFor="role">
                <Select id="role" name="role" defaultValue={target.role}>
                  <option value="user">user</option>
                  <option value="writer">writer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </Select>
              </Field>
              <Field label="Not" htmlFor="roleNote">
                <Input id="roleNote" name="note" />
              </Field>
            </PanelForm>

            {target.role === "writer" && (
              <PanelForm
                action={setWriterStatusAction}
                csrfToken={csrfToken}
                submitLabel="Yazar durumunu değiştir"
                submitVariant="secondary"
              >
                <input type="hidden" name="userId" value={target.id} />
                <Field label="Yazar durumu" htmlFor="writerStatus">
                  <Select
                    id="writerStatus"
                    name="writerStatus"
                    defaultValue={target.writerStatus ?? "pending_agreement"}
                  >
                    <option value="pending_agreement">Sözleşme bekliyor</option>
                    <option value="active">Aktif</option>
                    <option value="suspended">Donduruldu</option>
                  </Select>
                </Field>
              </PanelForm>
            )}

            {target.role === "editor" && (
              <PanelForm
                action={setEditorStatusAction}
                csrfToken={csrfToken}
                submitLabel="Editör durumunu değiştir"
                submitVariant="secondary"
              >
                <input type="hidden" name="userId" value={target.id} />
                <Field
                  label="Editör durumu"
                  htmlFor="editorStatus"
                  hint="Dondurulan editör rolünü ve kayıtlarını korur; yalnızca paneli kapanır."
                >
                  <Select
                    id="editorStatus"
                    name="editorStatus"
                    defaultValue={target.editorStatus ?? "active"}
                  >
                    <option value="active">Aktif</option>
                    <option value="suspended">Donduruldu</option>
                  </Select>
                </Field>
              </PanelForm>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Hesap işlemleri</h2>

          <div className="space-y-5">
            <PanelForm
              action={setBannedAction}
              csrfToken={csrfToken}
              submitLabel={target.isBanned ? "Yasağı kaldır" : "Yasakla"}
              submitVariant={target.isBanned ? "secondary" : "danger"}
            >
              <input type="hidden" name="userId" value={target.id} />
              {!target.isBanned && <input type="hidden" name="banned" value="true" />}
              {!target.isBanned && (
                <Field label="Gerekçe" htmlFor="reason" hint="Yasaklamada zorunludur.">
                  <Input id="reason" name="reason" required />
                </Field>
              )}
            </PanelForm>

            <div className="border-t border-line pt-4">
              <PanelForm
                action={setBirthDateAction}
                csrfToken={csrfToken}
                submitLabel="Doğum tarihini güncelle"
                submitVariant="secondary"
              >
                <input type="hidden" name="userId" value={target.id} />
                <Field
                  label="Doğum tarihi"
                  htmlFor="birthDate"
                  hint="Kullanıcı kendi tarihini değiştiremez; bu alan yalnızca yöneticide."
                >
                  <Input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    defaultValue={target.birthDate ?? ""}
                    required
                  />
                </Field>
              </PanelForm>
            </div>

            <div className="border-t border-line pt-4">
              <PanelForm
                action={deleteUserAction}
                csrfToken={csrfToken}
                submitLabel="Kullanıcıyı sil"
                submitVariant="danger"
                requireValid
              >
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  <Field
                    label="Gerekçe"
                    htmlFor="deleteReason"
                    hint="Kişisel veriler anonimleştirilir; imzalı hak devri kayıtları hukuki dayanak gereği saklanır."
                  >
                    <Input id="deleteReason" name="reason" required maxLength={500} />
                  </Field>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="confirm"
                      required
                      className="mt-0.5 size-4 rounded border-line"
                    />
                    Bu hesabı kalıcı olarak siliyorum; tüm oturumları kapatılacak.
                  </label>
                </>
              </PanelForm>
            </div>

            <div className="border-t border-line pt-4">
              <ActionButton
                action={revokeUserSessionsAction}
                csrfToken={csrfToken}
                label="Tüm oturumlarını kapat"
                fields={{ userId: target.id }}
                confirmMessage="Bu kullanıcının tüm oturumları kapatılacak. Devam edilsin mi?"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Rol değişikliği geçmişi</h2>

          {history.length === 0 ? (
            <EmptyState>Rol değişikliği yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tarih</Th>
                  <Th>Değişiklik</Th>
                  <Th>Yapan</Th>
                  <Th>Not</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                    <Td className="text-xs">
                      {row.oldRole} → {row.newRole}
                    </Td>
                    <Td className="text-xs">{row.changedByName ?? "sistem"}</Td>
                    <Td className="text-xs">{row.note ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <p className="text-sm">
          <Link href="/admin/users" className="text-muted underline hover:text-ink">
            Kullanıcı listesine dön
          </Link>
        </p>
      </div>
    </>
  );
}
