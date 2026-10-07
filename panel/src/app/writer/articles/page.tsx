import Link from "next/link";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articleComments, issues, users } from "@/db/schema";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { issueIdsWithArticlesBy, listArticlesForWriter } from "@/services/articles";
import { getActiveIssue } from "@/services/active-issue";
import { pickListIssue } from "@/lib/active-issue";
import { formatWordCount } from "@/lib/word-count";
import { IssuePicker } from "@/components/issue-picker";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Yazılarım" };

/**
 * The author's own writing area (step 1 of the review chain, D-059): they
 * draft an article, send it for review, and see its journey plus the editorial
 * notes on it. Drafts and revision requests are editable; once in review only
 * the reviewers touch the text.
 */
export default async function WriterArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ issueId?: string }>;
}) {
  const { user } = await guardWriterInnerPages();
  const { issueId } = await searchParams;

  // The issues this writer has articles in, plus the active one (D-330)
  const [ownIssueIds, activeIssue] = await Promise.all([issueIdsWithArticlesBy(user.id), getActiveIssue()]);
  const pickable = [...new Set([...ownIssueIds, ...(activeIssue ? [activeIssue.id] : [])])];
  const issueRows =
    pickable.length > 0
      ? await db
          .select({ id: issues.id, number: issues.number, title: issues.title })
          .from(issues)
          .where(and(inArray(issues.id, pickable), isNull(issues.deletedAt)))
          .orderBy(desc(issues.number))
      : [];
  const selected = pickListIssue(issueRows, issueId, activeIssue?.id ?? null);
  const assigned = selected ? await listArticlesForWriter({ ...user }, selected.id) : [];

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

      {selected && (
        <Card className="mb-5">
          <IssuePicker issues={issueRows} selectedId={selected.id} activeId={activeIssue?.id ?? null} />
          <p className="mt-3 text-xs text-muted">
            Bu sayıda {assigned.length} yazınız var
            {assigned.length > 0 &&
              `, toplam ${formatWordCount(assigned.reduce((sum, article) => sum + article.wordCount, 0))}`}
            .
          </p>
        </Card>
      )}

      {assigned.length === 0 ? (
        <EmptyState>Bu sayıda yazınız yok. &ldquo;Yeni yazı&rdquo; ile başlayın.</EmptyState>
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
                      {/* Always a way in (D-243). The title used to stop being
                          a link the moment the article left the author's
                          hands, which also shut the author out of the page
                          that holds the editor's notes, the article's steps
                          and its version history — the very things they most
                          want to see while it is being reviewed. Editing is
                          refused by the page itself, not by hiding the door. */}
                      <Link href={`/writer/articles/${article.id}`} className="hover:underline">
                        {article.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {issue ? `Sayı ${issue.number} · ${issue.title}` : "Sayıya atanmadı"}
                      {article.category && ` · ${article.category}`}
                      {` · ${formatWordCount(article.wordCount)}`}
                      {article.dueDate && ` · Teslim: ${formatDate(article.dueDate)}`}
                      {article.publishedAt && ` · Yayın: ${formatDate(article.publishedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/writer/articles/${article.id}`}
                      className="text-sm text-accent underline"
                    >
                      {editable(article.status) ? "Düzenle" : "Sürümler ve notlar"}
                    </Link>
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