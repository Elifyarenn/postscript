import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { articleComments, articles, issues, users } from "@/db/schema";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { listArticlesForWriter } from "@/services/articles";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Makalelerim" };

/**
 * Read-only, by design: in this phase articles are created and edited by
 * editors only (§14). The writer sees status, deadline and editorial notes.
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

  return (
    <>
      <PageHeader
        title="Makalelerim"
        description="Size atanan yazılar. Bu aşamada yazı gönderimi panelden yapılmaz."
      />

      {assigned.length === 0 ? (
        <EmptyState>Size atanmış makale yok.</EmptyState>
      ) : (
        <div className="space-y-5">
          {assigned.map((article) => {
            const notes = comments.filter((comment) => comment.articleId === article.id);
            const issue = article.issueId ? issueById.get(article.issueId) : undefined;

            return (
              <Card key={article.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg">{article.title}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {issue ? `Sayı ${issue.number} · ${issue.title}` : "Sayıya atanmadı"}
                      {article.dueDate && ` · Teslim: ${formatDate(article.dueDate)}`}
                      {article.publishedAt && ` · Yayın: ${formatDate(article.publishedAt)}`}
                    </p>
                  </div>
                  <StatusBadge status={article.status} />
                </div>

                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="mb-2 text-sm font-medium">Editör notları</h3>
                  {notes.length === 0 ? (
                    <p className="text-sm text-muted">Not yok.</p>
                  ) : (
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
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
