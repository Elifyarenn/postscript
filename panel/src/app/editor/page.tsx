import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { listArticles } from "@/services/articles";
import { listIssues } from "@/services/issues";
import { listPendingApprovals } from "@/services/rights";
import { getEditorAssignment } from "@/services/editor-categories";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { ArticleStatus } from "@/db/schema";

export const metadata = { title: "Editör paneli" };

/**
 * The editor dashboard shows only the review queues the signed-in reviewer can
 * act on (D-059): a category editor sees the `in_review` articles of their own
 * areas, a main editor adds the second review stage, and an admin sees the
 * publication queues (`ready_for_publishing`, `awaiting_rights`, `scheduled`).
 */
export default async function EditorDashboard() {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const isAdmin = user.role === "admin";
  const assignment = isAdmin ? null : await getEditorAssignment(user.id);

  const queues: { status: ArticleStatus; label: string }[] = isAdmin
    ? [
        { status: "ready_for_publishing", label: "Yayın kuyruğu" },
        { status: "awaiting_rights", label: "Devir formu bekleniyor" },
        { status: "scheduled", label: "Yayına planlandı" },
      ]
    : assignment?.isMainEditor
      ? [
          { status: "in_review", label: "Kategori onayı bekliyor" },
          { status: "pending_admin_approval", label: "Ana editör onayı bekliyor" },
          { status: "revision_requested", label: "Revizyon bekleniyor" },
        ]
      : [
          { status: "in_review", label: "Alanınıza düşen incelemeler" },
          { status: "revision_requested", label: "Revizyon bekleniyor" },
        ];

  const [articles, issues, pendingGrants] = await Promise.all([
    listArticles(actor, { limit: 200 }),
    isAdmin ? listIssues(actor) : Promise.resolve([]),
    isAdmin ? listPendingApprovals(actor) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={isAdmin ? "Yayın kuyruğu" : "Editör paneli"}
        description={
          isAdmin
            ? "Onay zincirinden gelen yazılar ve yayınlanacak işler."
            : "Sorumlu olduğunuz alanlara düşen yazıların incelemesi."
        }
      />

      <div className="space-y-6">
        {!isAdmin && assignment && assignment.assignedAreas.length === 0 && (
          <Alert tone="warning" title="Alan atanmamış">
            Henüz size sorumlu alan atanmadı; yönetici size bir alan atayana kadar
            inceleme kuyruğu boş görünür.
          </Alert>
        )}

        {!isAdmin && !assignment?.isMainEditor && assignment && assignment.assignedAreas.length > 0 && (
          <Alert tone="info" title="İnceleme kapsamınız">
            Yalnızca şu alanlara düşen yazıları görebilir ve onaylayabilirsiniz:{" "}
            {assignment.assignedAreas.join(", ")}.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => {
            const count = articles.filter((article) => article.status === queue.status).length;
            return (
              <Link
                key={queue.status}
                href={`/editor/articles?status=${queue.status}`}
                className="rounded-lg border border-line bg-surface p-4 hover:border-accent"
              >
                <p className="font-serif text-3xl">{count}</p>
                <p className="mt-1 text-sm text-muted">{queue.label}</p>
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg">İmza bekleyen devir formları</h2>
                <Link href="/editor/approvals" className="text-sm text-accent underline">
                  Tümü
                </Link>
              </div>

              {pendingGrants.length === 0 ? (
                <EmptyState>Bekleyen form yok.</EmptyState>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {pendingGrants.slice(0, 6).map((grant) => (
                    <li key={grant.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate">{grant.articleTitle}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {grant.writerName} · {formatDate(grant.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-serif text-lg">Sayılar</h2>
                <Link href="/editor/issues" className="text-sm text-accent underline">
                  Tümü
                </Link>
              </div>

              {issues.length === 0 ? (
                <EmptyState>Henüz sayı oluşturulmadı.</EmptyState>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {issues.slice(0, 6).map((issue) => (
                    <li key={issue.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span>
                        Sayı {issue.number} · {issue.title}
                      </span>
                      <StatusBadge status={issue.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}