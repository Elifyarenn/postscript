import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { listAllCommentsForAdmin, listAllMessagesForAdmin } from "@/services/community";
import { PanelForm } from "@/components/form";
import { Card, EmptyState, PersonName, Table, Td, Th } from "@/components/ui";
import { accountLabel } from "../account-label";
import { CommunityAdminHeader } from "../community-admin-header";
import { removeChatMessageAction, removeCommentAction } from "../../actions";

export const metadata = { title: "Yorumlar ve sohbet" };

/**
 * Article comments and the old community chat's messages (D-040, D-056, D-180).
 * Removed rows stay visible, marked, so an admin can see what was moderated.
 */
export default async function CommunityCommentsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const [comments, messages] = await Promise.all([
    listAllCommentsForAdmin({ ...user }, 150),
    listAllMessagesForAdmin({ ...user }, 150),
  ]);

  return (
    <>
      <CommunityAdminHeader title="Yorumlar ve sohbet" description="Yazı yorumları ve eski topluluk sohbetinin mesajları." />

      <div className="space-y-6">
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
                    <Td className="text-xs">
                      <PersonName
                        person={{
                          penName: row.authorPenName,
                          penNameSlug: row.authorPenNameSlug,
                          username: row.authorUsername,
                        }}
                        name={accountLabel(row.authorName, row.authorUsername)}
                      />
                    </Td>
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
                    <Td className="text-xs">
                      <PersonName
                        person={{
                          penName: row.authorPenName,
                          penNameSlug: row.authorPenNameSlug,
                          username: row.authorUsername,
                        }}
                        name={accountLabel(row.authorName, row.authorUsername)}
                      />
                    </Td>
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
