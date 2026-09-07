import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { roleChanges, users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { checkPromotionReadiness, findUserById } from "@/services/users";
import { renderAgreementForWriter } from "@/services/agreements";
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
  promoteToWriterAction,
  revokeUserSessionsAction,
  setBannedAction,
  setBirthDateAction,
  setEditorStatusAction,
  setWriterStatusAction,
} from "../../actions";

export const metadata = { title: "Kullanıcı" };

/** The precondition list §9 asks for: every rule with a tick or a cross. */
const RULES = [
  { id: "email_not_verified", label: "E-posta adresi doğrulanmış" },
  { id: "birth_date_missing", label: "Doğum tarihi girilmiş" },
  { id: "under_age", label: "18 yaşını doldurmuş" },
  { id: "kvkk_consent_missing", label: "KVKK onayı alınmış" },
  { id: "banned", label: "Yasaklı değil" },
  { id: "no_agreement_version", label: "Yayınlanmış bir sözleşme sürümü var" },
  { id: "agreement_not_renderable", label: "Sözleşme bu kullanıcı için render ediliyor" },
] as const;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardPanel("admin");
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  const target = await findUserById(id);
  const readiness = await checkPromotionReadiness(target);

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
            <StatusBadge status={target.role} />
            {target.writerStatus && <StatusBadge status={target.writerStatus} />}
          </>
        }
      />

      <div className="space-y-6">
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
