import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { listArticles } from "@/services/articles";
import { listIssues } from "@/services/issues";
import { listPendingApprovals } from "@/services/rights";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { ArticleStatus } from "@/db/schema";

export const metadata = { title: "Editör paneli" };

/** Statuses worth a queue of their own on the overview. */
const QUEUES: { status: ArticleStatus; label: string }[] = [
  { status: "in_review", label: "İncelemede" },
  { status: "revision_requested", label: "Revizyon istendi" },
  { status: "awaiting_rights", label: "Devir formu bekleniyor" },
  { status: "scheduled", label: "Yayına planlandı" },
];

export default async function EditorDashboard() {
  const { user } = await guardPanel("editor");
  const actor = { ...user };

  const [articles, issues, pendingGrants] = await Promise.all([
    listArticles(actor, { limit: 200 }),
    listIssues(actor),
    listPendingApprovals(actor),
  ]);

  return (
    <>
      <PageHeader title="Editör paneli" description="Sıradaki işler ve açık sayılar." />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUEUES.map((queue) => {
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

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg">İmza bekleyen devir formları</h2>
            <Link href="/editor/rights" className="text-sm text-accent underline">
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
      </div>
    </>
  );
}
