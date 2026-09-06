import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { roleChanges, users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { checkWriterEligibility, findUserById, listIdentityDocuments } from "@/services/users";
import { readCsrfToken } from "@/lib/csrf";
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
  setWriterStatusAction,
  uploadIdentityDocumentAction,
  verifyIdentityAction,
} from "../../actions";

export const metadata = { title: "Kullanıcı" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await guardPanel("admin");
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  const target = await findUserById(id);
  const eligibility = checkWriterEligibility(target);
  const documents = await listIdentityDocuments({ ...user }, id);

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
            <Alert tone="info">
              Bu kullanıcı zaten &ldquo;{target.role}&rdquo; rolünde.
            </Alert>
          ) : eligibility.eligible ? (
            <>
              <Alert tone="success">Tüm ön koşullar sağlanıyor.</Alert>
              <div className="mt-4">
                <PanelForm
                  action={promoteToWriterAction}
                  csrfToken={csrfToken}
                  submitLabel="Yazar yap"
                >
                    <>
                      <input type="hidden" name="userId" value={target.id} />
                      <Field label="Not" htmlFor="note" hint="Rol değişikliği kaydına yazılır.">
                        <Input id="note" name="note" />
                      </Field>
                    </>
                </PanelForm>
              </div>
            </>
          ) : (
            <Alert tone="warning" title="Ön koşullar sağlanmıyor">
              <ul className="mt-1 list-disc pl-5">
                {eligibility.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Kimlik doğrulama</h2>

          {target.identityVerifiedAt ? (
            <Alert tone="success">
              {formatDateTime(target.identityVerifiedAt)} tarihinde doğrulandı.
            </Alert>
          ) : (
            <Alert tone="warning">Kimlik henüz doğrulanmadı.</Alert>
          )}

          <div className="mt-4 space-y-5">
            <PanelForm
              action={uploadIdentityDocumentAction}
              csrfToken={csrfToken}
              submitLabel="Belge yükle"
              submitVariant="secondary"
            >
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  <Field
                    label="Kimlik belgesi"
                    htmlFor="file"
                    hint="Ayrı bir kovada saklanır, yalnızca yönetici görür, 90 gün sonra otomatik silinir."
                  >
                    <Input
                      id="file"
                      name="file"
                      type="file"
                      required
                      accept="image/jpeg,image/png,application/pdf"
                    />
                  </Field>
                </>
            </PanelForm>

            {documents.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th>Belge</Th>
                    <Th>Yükleme</Th>
                    <Th>Otomatik silme</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <Td className="text-xs">{document.mime}</Td>
                      <Td className="text-xs">{formatDate(document.createdAt)}</Td>
                      <Td className="text-xs">
                        {document.purgedAt ? "silindi" : formatDate(document.autoDeleteAt)}
                      </Td>
                      <Td className="text-right">
                        {!document.purgedAt && (
                          <a
                            href={`/api/media/${document.id}`}
                            className="text-xs text-accent underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Görüntüle
                          </a>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}

            {!target.identityVerifiedAt && (
              <ActionButton
                action={verifyIdentityAction}
                csrfToken={csrfToken}
                label="Kimliği doğrulandı olarak işaretle"
                variant="primary"
                fields={{ userId: target.id }}
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Rol ve durum</h2>

          <div className="grid gap-6 lg:grid-cols-2">
            <PanelForm
              action={changeRoleAction}
              csrfToken={csrfToken}
              submitLabel="Rolü değiştir"
              submitVariant="secondary"
            >
                <>
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
                </>
            </PanelForm>

            {target.role !== "user" && (
              <PanelForm
                action={setWriterStatusAction}
                csrfToken={csrfToken}
                submitLabel="Yazar durumunu değiştir"
                submitVariant="secondary"
              >
                  <>
                    <input type="hidden" name="userId" value={target.id} />
                    <Field label="Yazar durumu" htmlFor="writerStatus">
                      <Select
                        id="writerStatus"
                        name="writerStatus"
                        defaultValue={target.writerStatus ?? "pending_agreement"}
                      >
                        <option value="pending_agreement">Sözleşme bekliyor</option>
                        <option value="active">Aktif</option>
                        <option value="suspended">Askıda</option>
                      </Select>
                    </Field>
                  </>
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
                <>
                  <input type="hidden" name="userId" value={target.id} />
                  {!target.isBanned && <input type="hidden" name="banned" value="true" />}
                  {!target.isBanned && (
                    <Field label="Gerekçe" htmlFor="reason" hint="Yasaklamada zorunludur.">
                      <Input id="reason" name="reason" required />
                    </Field>
                  )}
                </>
            </PanelForm>

            <div className="border-t border-line pt-4">
              <PanelForm
                action={setBirthDateAction}
                csrfToken={csrfToken}
                submitLabel="Doğum tarihini güncelle"
                submitVariant="secondary"
              >
                  <>
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
