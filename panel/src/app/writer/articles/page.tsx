import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { articleComments, articles, issues, users } from "@/db/schema";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { listArticlesForWriter } from "@/services/articles";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Yazılarım" };

/**
 * The author's own writing area (step 1 of the review chain, D-059): they
 * draft an article, send it for review, and see its journey plus the editorial
 * notes on it. Drafts and revision requests are editable; once in review only
 * the reviewers touch the text.
 */
export default async function WriterArticlesPage() {
  const { user } = await guardWriterInnerPages();
  const assigned = await listArticlesForWriter({ ...user });

  const ids = assigned.map((article) => article.id);
  const comments =
    ids.length > 0
      ? await db
          .select({
            id: articleComments.id,
            articleId: articleComments.articleId,
            body: articleComments.body,
            createdAt: articleComments.createdAt,
            resolvedAt: articleComments.resolvedAt,
            authorName: users.displayName,
          })
          .from(articleComments)
          .leftJoin(users, eq(articleComments.authorId, users.id))
          .where(inArray(articleComments.articleId, ids))
      : [];

  const issueRows =
    ids.length > 0
      ? await db
          .select({ id: issues.id, number: issues.number, title: issues.title })
          .from(issues)
          .innerJoin(articles, eq(articles.issueId, issues.id))
          .where(inArray(articles.id, ids))
      : [];

  const issueById = new Map(issueRows.map((row) => [row.id, row]));
  const editable = (status: string) => status === "draft" || status === "revision_requested";

  return (
    <>
      <PageHeader
        title="Yazılarım"
        description="Yazınızı yazın, taslak kaydedin ve incelemeye gönderin."
        actions={
          <Link
            href="/writer/articles/new"
            className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Yeni yazı
          </Link>
        }
      />

      {assigned.length === 0 ? (
        <EmptyState>Henüz yazınız yok. &ldquo;Yeni yazı&rdquo; ile başlayın.</EmptyState>
      ) : (
        <div className="space-y-5">
          {assigned.map((article) => {
            const notes = comments.filter((comment) => comment.articleId === article.id);
            const issue = article.issueId ? issueById.get(article.issueId) : undefined;

            return (
              <Card key={article.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg">
                      {editable(article.status) ? (
                        <Link href={`/writer/articles/${article.id}`} className="hover:underline">
                          {article.title}
                        </Link>
                      ) : (
                        article.title
                      )}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {issue ? `Sayı ${issue.number} · ${issue.title}` : "Sayıya atanmadı"}
                      {article.category && ` · ${article.category}`}
                      {article.dueDate && ` · Teslim: ${formatDate(article.dueDate)}`}
                      {article.publishedAt && ` · Yayın: ${formatDate(article.publishedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {editable(article.status) && (
                      <Link
                        href={`/writer/articles/${article.id}`}
                        className="text-sm text-accent underline"
                      >
                        {article.status === "revision_requested" ? "Düzenle" : "Düzenle"}
                      </Link>
                    )}
                    <StatusBadge status={article.status} />
                  </div>
                </div>

                {notes.length > 0 && (
                  <div className="mt-4 border-t border-line pt-4">
                    <h3 className="mb-2 text-sm font-medium">Editör notları</h3>
                    <ul className="space-y-2.5 text-sm">
                      {notes.map((note) => (
                        <li key={note.id} className="rounded-md bg-paper px-3 py-2">
                          <p className="whitespace-pre-wrap">{note.body}</p>
                          <p className="mt-1 text-xs text-muted">
                            {note.authorName ?? "Editör"} · {formatDate(note.createdAt)}
                            {note.resolvedAt && " · çözüldü"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}