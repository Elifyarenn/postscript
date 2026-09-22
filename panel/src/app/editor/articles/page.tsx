import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { listArticles } from "@/services/articles";
import { listIssues } from "@/services/issues";
import {
  getEditorAssignment,
  getMainEditor,
  listEditorAreasWithHolders,
} from "@/services/editor-categories";
import { editorForArticle, type ArticleEditor } from "@/lib/article-editor";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
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
  Textarea,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { articleStatusEnum, type ArticleStatus } from "@/db/schema";
import { createArticleAction } from "../actions";

export const metadata = { title: "Kategoriye düşen yazılar" };

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
  searchParams: Promise<{ status?: string; issueId?: string; authorId?: string }>;
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

  const [articles, issues, writers, areas, mainEditor] = await Promise.all([
    listArticles(actor, {
      status,
      issueId: filters.issueId,
      authorId: filters.authorId,
      limit: 200,
    }),
    isAdmin
      ? listIssues(actor)
      : Promise.resolve([]),
    db
      .select({ id: users.id, displayName: users.displayName, penName: users.penName })
      .from(users)
      .where(and(inArray(users.role, ["writer", "editor", "admin"]), isNull(users.deletedAt)))
      .orderBy(users.displayName),
    // Which editor holds which area, so the list can say where a yazı went
    listEditorAreasWithHolders(),
    getMainEditor(),
  ]);

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

          <form method="get" className="grid gap-3 sm:grid-cols-2">
            <Field label="Durum" htmlFor="status">
              <Select id="status" name="status" defaultValue={filters.status ?? ""}>
                <option value="">Tümü</option>
                {articleStatusEnum.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value] ?? value}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Yazar" htmlFor="authorId">
              <Select id="authorId" name="authorId" defaultValue={filters.authorId ?? ""}>
                <option value="">Tümü</option>
                {writers.map((writer) => (
                  <option key={writer.id} value={writer.id}>
                    {writer.penName ?? writer.displayName}
                  </option>
                ))}
              </Select>
            </Field>

            {isAdmin && (
              <Field label="Sayı" htmlFor="issueId">
                <Select id="issueId" name="issueId" defaultValue={filters.issueId ?? ""}>
                  <option value="">Tümü</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      Sayı {issue.number} · {issue.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm hover:bg-paper"
              >
                Uygula
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">{articles.length} makale</h2>

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
                    <Td className="text-xs">
                      <EditorCell routed={editorForArticle(article, areas, mainEditor)} canOpenAccounts={isAdmin} />
                    </Td>
                    <Td>
                      <StatusBadge status={article.status} />
                    </Td>
                    <Td className="text-xs">{formatDate(article.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
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

                {isAdmin && (
                  <Field label="Sayı" htmlFor="newIssueId">
                    <Select id="newIssueId" name="issueId">
                      <option value="">Sayıya atanmadı</option>
                      {issues.map((issue) => (
                        <option key={issue.id} value={issue.id}>
                          Sayı {issue.number} · {issue.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Kategori" htmlFor="category">
                  <Input id="category" name="category" maxLength={80} />
                </Field>

                <Field label="Teslim tarihi" htmlFor="dueDate">
                  <Input id="dueDate" name="dueDate" type="date" />
                </Field>
              </div>

              <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
                <Textarea id="bodyMarkdown" name="bodyMarkdown" rows={10} />
              </Field>
            </>
          </PanelForm>
        </Card>
      </div>
    </>
  );
}