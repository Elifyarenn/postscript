import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { listRecentPostsForAdmin } from "@/services/posts";
import { PanelForm } from "@/components/form";
import { Card, EmptyState, Table, Td, Th } from "@/components/ui";
import { accountLabel } from "../account-label";
import { CommunityAdminHeader } from "../community-admin-header";
import { removePostAction } from "../actions";

export const metadata = { title: "Üye gönderileri" };

/** The newest member posts, removed ones marked, for moderation (D-090, D-180). */
export default async function CommunityPostsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const recentPosts = await listRecentPostsForAdmin({ ...user }, 150);

  return (
    <>
      <CommunityAdminHeader title="Üye gönderileri" description="En yeni 150 gönderi; kaldırılanlar işaretli kalır." />

      <div className="space-y-6">
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

      </div>
    </>
  );
}
