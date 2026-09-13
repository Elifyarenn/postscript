import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  listAllBannedWords,
  listAllCommentsForAdmin,
  listAllMessagesForAdmin,
} from "@/services/community";
import { listRecentPostsForAdmin } from "@/services/posts";
import { listReports } from "@/services/reports";
import { REPORT_CATEGORY_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui";
import { removePostAction, resolveReportAction } from "./actions";

/** The admin identifies the account, so the display name comes first here. */
function accountLabel(name: string | null, username: string | null): string {
  if (!name) return "Silinmiş kullanıcı";
  return username ? `${name} (@${username})` : name;
}
import {
  addBannedWordAction,
  removeBannedWordAction,
  removeChatMessageAction,
  removeCommentAction,
} from "../actions";

export const metadata = { title: "Topluluk yönetimi" };

/**
 * Moderation hub: the banned word blacklist plus every comment and chat
 * message. Removed rows stay visible here (marked) so an admin can see what
 * was moderated; deletion is a soft delete (D-015 style, append-only records).
 */
export default async function AdminCommunityPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";

  const [banned, comments, messages, openReports, closedReports, recentPosts] = await Promise.all([
    listAllBannedWords({ ...user }),
    listAllCommentsForAdmin({ ...user }, 150),
    listAllMessagesForAdmin({ ...user }, 150),
    listReports({ ...user }, "open"),
    listReports({ ...user }, "closed", 50),
    listRecentPostsForAdmin({ ...user }, 150),
  ]);

  const liveBanned = banned.filter((row) => row.deletedAt === null);

  return (
    <>
      <PageHeader
        title="Topluluk yönetimi"
        description="Yorumlar, sohbet mesajları ve yasaklı kelime listesi."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-serif text-lg">İçerik bildirimleri ({openReports.length} açık)</h2>
          <p className="mb-4 text-sm text-muted">
            Üyelerin &ldquo;Bildir&rdquo; ile gönderdiği şikâyetler, en eskisi üstte. 5651 sayılı Kanun
            gereği en geç 24 saat içinde sonuçlandırılmalı; süresi geçenler işaretlidir. Bir karar,
            aynı içerikle ilgili bütün açık bildirimleri kapatır ve bildirenlere sonucu bildirir.
          </p>

          {openReports.length === 0 ? (
            <EmptyState>Açık bildirim yok.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {openReports.map((report) => (
                <li
                  key={report.id}
                  className={cn(
                    "rounded-md border p-4",
                    report.overdue ? "border-danger/40 bg-danger-soft" : "border-line bg-paper",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{REPORT_TARGET_LABELS[report.targetType]}</span>
                    <span>· {REPORT_CATEGORY_LABELS[report.category]}</span>
                    <span className="text-muted">· {formatDateTime(report.createdAt)}</span>
                    {report.overdue && (
                      <span className="font-semibold text-danger">24 saat geçti</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{report.snapshot}</p>
                  {report.reason && (
                    <p className="mt-2 text-xs text-muted">Açıklama: {report.reason}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    İçerik sahibi: {accountLabel(report.ownerName, report.ownerUsername)} · Bildiren:{" "}
                    {accountLabel(report.reporterName, report.reporterUsername)}
                  </p>

                  <div className="mt-3 max-w-md">
                    <PanelForm
                      action={resolveReportAction}
                      csrfToken={csrfToken}
                      submitLabel="Sonuçlandır"
                      submitVariant="secondary"
                    >
                      <input type="hidden" name="reportId" value={report.id} />
                      <Field label="Karar" htmlFor={`decision-${report.id}`}>
                        <Select id={`decision-${report.id}`} name="decision" defaultValue="dismiss">
                          {report.targetType !== "member" && (
                            <option value="remove">İçeriği kaldır</option>
                          )}
                          <option value="dismiss">Kurallara aykırı değil</option>
                        </Select>
                      </Field>
                      <Field label="Not (isteğe bağlı)" htmlFor={`note-${report.id}`}>
                        <Input id={`note-${report.id}`} name="note" maxLength={1000} />
                      </Field>
                    </PanelForm>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {closedReports.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Son sonuçlandırılanlar</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>Tür</Th>
                    <Th>İçerik</Th>
                    <Th>Karar</Th>
                    <Th>Tarih</Th>
                  </tr>
                </thead>
                <tbody>
                  {closedReports.map((report) => (
                    <tr key={report.id}>
                      <Td className="text-xs">{REPORT_TARGET_LABELS[report.targetType]}</Td>
                      <Td className="max-w-md">
                        <p className="line-clamp-2 text-xs whitespace-pre-wrap">{report.snapshot}</p>
                      </Td>
                      <Td className="text-xs">
                        {report.status === "removed" ? "Kaldırıldı" : "Aykırı bulunmadı"}
                        {report.resolutionNote && (
                          <span className="block text-muted">{report.resolutionNote}</span>
                        )}
                      </Td>
                      <Td className="text-xs">{formatDateTime(report.resolvedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Üye gönderileri ({recentPosts.length})</h2>

          {recentPosts.length === 0 ? (
            <EmptyState>Henüz gönderi yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Gönderi</Th>
                  <Th>Yazan</Th>
                  <Th>Tarih</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {recentPosts.map((row) => (
                  <tr key={row.id}>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 text-xs whitespace-pre-wrap">{row.body}</p>
                      {row.deletedAt && (
                        <span className="text-xs text-danger">
                          {row.removedBy ? "yönetici kaldırdı" : "yazarı sildi"}
                        </span>
                      )}
                    </Td>
                    <Td className="text-xs">{accountLabel(row.authorName, row.authorUsername)}</Td>
                    <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                    <Td className="text-right">
                      {!row.deletedAt && (
                        <PanelForm
                          action={removePostAction}
                          csrfToken={csrfToken}
                          submitLabel="Kaldır"
                          submitVariant="danger"
                        >
                          <input type="hidden" name="postId" value={row.id} />
                        </PanelForm>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg">Yasaklı kelimeler ({liveBanned.length})</h2>

            <PanelForm
              action={addBannedWordAction}
              csrfToken={csrfToken}
              submitLabel="Ekle"
              submitVariant="secondary"
            >
              <Field label="Kelime" htmlFor="word">
                <Input id="word" name="word" required minLength={2} maxLength={100} placeholder="ör. küfür" />
              </Field>
            </PanelForm>
          </div>

          <Alert tone="info">
            Bu listedeki kelimeler yorumlarda ve sohbette otomatik yıldızlanır. Eşleştirme
            büyük/küçük harfe duyarsız ve ek almış biçimleri de yakalar; liste bu yüzden
            yönetici tarafından denetlenir.
          </Alert>

          <div className="mt-4">
            {banned.length === 0 ? (
              <EmptyState>Listede kelime yok.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Kelime</Th>
                    <Th>Eklendi</Th>
                    <Th>Durum</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {banned.map((row) => (
                    <tr key={row.id}>
                      <Td className="font-mono">{row.word}</Td>
                      <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                      <Td>
                        {row.deletedAt ? (
                          <span className="text-xs text-danger">kaldırıldı</span>
                        ) : (
                          <span className="text-xs text-accent">aktif</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {!row.deletedAt && (
                          <PanelForm
                            action={removeBannedWordAction}
                            csrfToken={csrfToken}
                            submitLabel="Kaldır"
                            submitVariant="secondary"
                          >
                            <input type="hidden" name="wordId" value={row.id} />
                          </PanelForm>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Yorumlar ({comments.length})</h2>

          {comments.length === 0 ? (
            <EmptyState>Henüz yorum yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Yorum</Th>
                  <Th>Yazar</Th>
                  <Th>Yazı</Th>
                  <Th>Tarih</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {comments.map((row) => (
                  <tr key={row.id}>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs">{row.body}</p>
                      {row.deletedAt && (
                        <span className="text-xs text-danger">kaldırıldı</span>
                      )}
                    </Td>
                    <Td className="text-xs">{row.authorName ?? "Silinmiş kullanıcı"}</Td>
                    <Td className="text-xs">{row.articleTitle}</Td>
                    <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                    <Td className="text-right">
                      {!row.deletedAt && (
                        <PanelForm
                          action={removeCommentAction}
                          csrfToken={csrfToken}
                          submitLabel="Kaldır"
                          submitVariant="danger"
                        >
                          <input type="hidden" name="commentId" value={row.id} />
                        </PanelForm>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Sohbet mesajları ({messages.length})</h2>

          {messages.length === 0 ? (
            <EmptyState>Henüz mesaj yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Mesaj</Th>
                  <Th>Yazar</Th>
                  <Th>Tarih</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {messages.map((row) => (
                  <tr key={row.id}>
                    <Td className="max-w-md">
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs">{row.body}</p>
                      {row.deletedAt && (
                        <span className="text-xs text-danger">kaldırıldı</span>
                      )}
                    </Td>
                    <Td className="text-xs">{row.authorName ?? "Silinmiş kullanıcı"}</Td>
                    <Td className="text-xs">{formatDateTime(row.createdAt)}</Td>
                    <Td className="text-right">
                      {!row.deletedAt && (
                        <PanelForm
                          action={removeChatMessageAction}
                          csrfToken={csrfToken}
                          submitLabel="Kaldır"
                          submitVariant="danger"
                        >
                          <input type="hidden" name="messageId" value={row.id} />
                        </PanelForm>
                      )}
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