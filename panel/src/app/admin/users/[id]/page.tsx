import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { roleChanges, users, type User } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { isAppError } from "@/lib/errors";
import { checkPromotionReadiness, findUserById } from "@/services/users";
import { renderAgreementForWriter } from "@/services/agreements";
import { listAllWriterAreasWithQuota } from "@/services/writer-areas";
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
  deleteUserAction,
  promoteToWriterAction,
  revokeUserSessionsAction,
  setBannedAction,
  setBirthDateAction,
  setEditorDutiesAction,
  setEditorStatusAction,
  setHybridWriterRoleAction,
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
  await guardPanel("admin");
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
            {target.role === "editor" && target.writerStatus !== null ? (
              <StatusBadge status="editor_writer" />
            ) : (
              <>
                <StatusBadge status={target.role} />
                {target.writerStatus && <StatusBadge status={target.writerStatus} />}
              </>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Kayıt bilgileri</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">E-posta</dt>
              <dd className="text-ink">{target.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Telefon</dt>
              <dd className="text-ink">{target.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Doğum tarihi</dt>
              <dd className="text-ink">{target.birthDate ? formatDate(target.birthDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Alan</dt>
              <dd className="text-ink">{target.writerArea ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">2. alan</dt>
              <dd className="text-ink">{target.writerArea2 ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Kayıt</dt>
              <dd className="text-ink">{formatDateTime(target.createdAt)}</dd>
            </div>
          </dl>
        </Card>

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
