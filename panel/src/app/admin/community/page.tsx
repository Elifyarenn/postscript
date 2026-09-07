import Link from "next/link";
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

  const [banned, comments, messages] = await Promise.all([
    listAllBannedWords({ ...user }),
    listAllCommentsForAdmin({ ...user }, 150),
    listAllMessagesForAdmin({ ...user }, 150),
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

        <p className="text-sm text-muted">
          <Link href="/community" className="text-accent underline">
            Topluluk sohbetini aç
          </Link>
        </p>
      </div>
    </>
  );
}