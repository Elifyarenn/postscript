import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  ARTICLE_SORTS,
  countArticlesByStatus,
  listArticles,
  parseArticleSort,
} from "@/services/articles";
import { listIssues } from "@/services/issues";
import { getActiveIssue } from "@/services/active-issue";
import { isIssueClosed, pickListIssue } from "@/lib/active-issue";
import { formatWordCount } from "@/lib/word-count";
import { IssuePicker, issueLabel } from "@/components/issue-picker";
import { categoryBudgetForForm } from "@/services/category-budget";
import {
  getEditorAssignment,
  getMainEditor,
  listEditorAreasWithHolders,
} from "@/services/editor-categories";
import { editorForArticle, type ArticleEditor } from "@/lib/article-editor";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { ArticleBodyTextarea } from "@/components/article-body-textarea";
import {
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PersonName,
  Select,
  StatusBadge,
  STATUS_LABELS,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { articleStatusEnum, type ArticleStatus } from "@/db/schema";
import { createArticleAction } from "../actions";

export const metadata = { title: "Kategoriye düşen yazılar" };

const PAGE_SIZE = 50;

/**
 * The "Editör" cell: whose desk the article is on right now (D-152). The
 * name leads to the account, but only for an admin — the account pages are
 * theirs, and an editor would be handed a link they cannot open (D-233).
 */
function EditorCell({ routed, canOpenAccounts }: { routed: ArticleEditor; canOpenAccounts: boolean }) {
  const named = (id: string, name: string) =>
    canOpenAccounts ? (
      <Link href={`/admin/users/${id}`} className="hover:text-accent hover:underline">
        {name}
      </Link>
    ) : (
      <>{name}</>
    );

  switch (routed.kind) {
    case "editor":
      return named(routed.id, routed.name);
    case "main":
      return routed.person ? (
        <>
          {named(routed.person.id, routed.person.displayName)}{" "}
          <span className="text-muted">· ana editör</span>
        </>
      ) : (
        <span className="text-warning">Ana editör atanmamış</span>
      );
    case "unassigned":
      return <span className="text-warning">Atanmamış</span>;
    default:
      return <>—</>;
  }
}

export default async function EditorArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    issueId?: string;
    authorId?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";
  const filters = await searchParams;
  const isAdmin = user.role === "admin";
  const assignment = isAdmin ? null : await getEditorAssignment(user.id);

  const status = articleStatusEnum.enumValues.includes(filters.status as ArticleStatus)
    ? (filters.status as ArticleStatus)
    : undefined;

  // Every editor filters and files by issue (D-261); the admins' working
  // issue is still left out for them by `listIssues`. One issue at a time,
  // the active one unless another is asked for (D-330)
  const [issues, activeIssue] = await Promise.all([listIssues(actor), getActiveIssue()]);
  const selected = pickListIssue(issues, filters.issueId, activeIssue?.id ?? null);
  const sort = parseArticleSort(filters.sort);
  const q = filters.q?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const listFilters = { issueId: selected?.id ?? "", authorId: filters.authorId || undefined, q };

  const [list, statusCounts, writers, areas, mainEditor] = await Promise.all([
    selected
      ? listArticles(actor, { ...listFilters, status, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      : Promise.resolve({ items: [], total: 0 }),
    selected ? countArticlesByStatus(actor, listFilters) : Promise.resolve(new Map<ArticleStatus, number>()),
    db
      .select({ id: users.id, displayName: users.displayName, penName: users.penName })
      .from(users)
      .where(and(inArray(users.role, ["writer", "editor", "admin"]), isNull(users.deletedAt)))
      .orderBy(users.displayName),
    // Which editor holds which area, so the list can say where a yazı went
    listEditorAreasWithHolders(),
    getMainEditor(),
  ]);
  const articles = list.items;
  // Shown for the active issue, the form's default; the server checks the issue chosen (D-331)
  const budgetData = activeIssue ? await categoryBudgetForForm(activeIssue.id) : null;
  const pageCount = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const inIssue = [...statusCounts.values()].reduce((sum, value) => sum + value, 0);
  const openIssues = issues.filter((issue) => !isIssueClosed(issue));
  // Every filter but the page, so the page links keep them
  const keep = {
    issueId: selected?.id,
    status,
    authorId: filters.authorId || undefined,
    q,
    sort: sort === "updated" ? undefined : sort,
  };
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
    if (target > 1) params.set("page", String(target));
    return `/editor/articles?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Kategoriye düşen yazılar"
        description={
          isAdmin
            ? "Onay zincirinin tüm kademeleri ve yayın kuyruğu."
            : assignment?.isMainEditor
              ? "Tüm kategorilerdeki yazılar: kategori onayı ve ana editör onayı."
              : "Sorumlu olduğunuz alanlara düşen yazılar; burada inceleyip düzenlersiniz."
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Filtrele</h2>

          {selected ? (
            <IssuePicker issues={issues} selectedId={selected.id} activeId={activeIssue?.id ?? null}>
              <Field label="Ara" htmlFor="q" hint="Başlıkta geçen kelime">
                <Input id="q" name="q" type="search" maxLength={100} defaultValue={q ?? ""} />
              </Field>

              <Field label="Durum" htmlFor="status">
                <Select id="status" name="status" defaultValue={status ?? ""}>
                  <option value="">Tüm durumlar</option>
                  {articleStatusEnum.enumValues.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value] ?? value} ({statusCounts.get(value) ?? 0})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Yazar" htmlFor="authorId">
                <Select id="authorId" name="authorId" defaultValue={filters.authorId ?? ""}>
                  <option value="">Tüm yazarlar</option>
                  {writers.map((writer) => (
                    <option key={writer.id} value={writer.id}>
                      {writer.penName ?? writer.displayName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Sıralama" htmlFor="sort">
                <Select id="sort" name="sort" defaultValue={sort}>
                  {Object.entries(ARTICLE_SORTS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </IssuePicker>
          ) : (
            <EmptyState>Henüz sayı yok.</EmptyState>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-serif text-lg">
            {selected ? `Sayı ${selected.number}: ` : ""}
            {list.total} makale
          </h2>
          <p className="mb-4 text-xs text-muted">
            Bu sayıda kapsamınıza giren toplam {inIssue} yazı
            {pageCount > 1 ? ` · sayfa ${Math.min(page, pageCount)} / ${pageCount}` : ""}
          </p>

          {articles.length === 0 ? (
            <EmptyState>
              {status
                ? "Bu durumda ve kapsamınızda makale yok."
                : "Kapsamınıza giren makale yok."}
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Başlık</Th>
                  <Th>Yazar</Th>
                  <Th>Kategori</Th>
                  <Th>Kelime</Th>
                  <Th>Editör</Th>
                  <Th>Durum</Th>
                  <Th>Güncelleme</Th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <Td>
                      <Link
                        href={`/editor/articles/${article.id}`}
                        className="text-accent hover:underline"
                      >
                        {article.title}
                      </Link>
                    </Td>
                    <Td className="text-xs">
                      <PersonName
                        person={{
                          penName: article.authorPenName,
                          penNameSlug: article.authorPenNameSlug,
                          username: article.authorUsername,
                        }}
                        name={article.authorName}
                      />
                    </Td>
                    <Td className="text-xs">{article.category ?? "—"}</Td>
                    <Td className="text-xs whitespace-nowrap">{formatWordCount(article.wordCount)}</Td>
                    <Td className="text-xs">
                      <EditorCell routed={editorForArticle(article, areas, mainEditor)} canOpenAccounts={isAdmin} />
                    </Td>
                    <Td>
                      <StatusBadge status={article.status} />
                      {/* The main editor's request is addressed to the category editor (D-331) */}
                      {article.editorRevisionRequested && (
                        <p className="mt-1 text-xs text-warning">Ana editör revizyon istedi</p>
                      )}
                    </Td>
                    <Td className="text-xs">{formatDate(article.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {pageCount > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Sayfalar">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="text-accent underline">
                  ← Önceki
                </Link>
              ) : (
                <span />
              )}
              {page < pageCount && (
                <Link href={pageHref(page + 1)} className="text-accent underline">
                  Sonraki →
                </Link>
              )}
            </nav>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Yeni makale kaydı</h2>

          <PanelForm action={createArticleAction} csrfToken={csrfToken} submitLabel="Oluştur">
            <>
              <Field label="Başlık" htmlFor="title">
                <Input id="title" name="title" required maxLength={200} />
              </Field>

              <Field label="Özet" htmlFor="summary">
                <Input id="summary" name="summary" maxLength={600} />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Yazar" htmlFor="newAuthorId">
                  <Select id="newAuthorId" name="authorId">
                    <option value="">Sonra atanacak</option>
                    {writers.map((writer) => (
                      <option key={writer.id} value={writer.id}>
                        {writer.penName ?? writer.displayName}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Every article belongs to an issue (D-261) */}
                <Field label="Sayı" htmlFor="newIssueId">
                    <Select id="newIssueId" name="issueId" required defaultValue={activeIssue?.id ?? ""}>
                      <option value="" disabled>
                        Sayı seçin…
                      </option>
                      {/* A published issue takes no new article (D-330) */}
                      {openIssues.map((issue) => (
                        <option key={issue.id} value={issue.id}>
                          {issueLabel(issue, activeIssue?.id ?? null)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                <Field label="Kategori" htmlFor="category">
                  <Input id="category" name="category" maxLength={80} />
                </Field>

                <Field label="Teslim tarihi" htmlFor="dueDate">
                  <Input id="dueDate" name="dueDate" type="date" />
                </Field>
              </div>

              <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
                <ArticleBodyTextarea
                  id="bodyMarkdown"
                  name="bodyMarkdown"
                  rows={10}
                  budget={budgetData ? { ...budgetData, categoryFieldId: "category" } : undefined}
                />
              </Field>
            </>
          </PanelForm>
        </Card>
      </div>
    </>
  );
}