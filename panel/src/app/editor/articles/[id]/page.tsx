import Link from "next/link";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  allowedTargetsForActor,
  assertCanReadArticle,
  findArticleById,
  listArticleVersions,
  listComments,
} from "@/services/articles";
import { listIssues } from "@/services/issues";
import { findLiveApproval } from "@/services/rights";
import { allMediaLicensed } from "@/services/media";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { ActionButton, PanelForm } from "@/components/form";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StatusPanel } from "./status-panel";
import {
  addCommentAction,
  resolveCommentAction,
  setPlagiarismAction,
  transitionArticleAction,
  updateArticleAction,
} from "../../actions";

export const metadata = { title: "Makale" };

export default async function EditorArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const isAdmin = user.role === "admin";
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  const article = await findArticleById(id);
  // A category editor may only open articles in their own areas (D-059)
  await assertCanReadArticle(actor, article);
  const targets = await allowedTargetsForActor(actor, article);

  // The media card is gone from this page (D-080), but the licence check stays:
  // media attached earlier still blocks publishing until it is licensed.
  const [grant, versions, comments, issues, writers, licensed] =
    await Promise.all([
      findLiveApproval(article.id),
      listArticleVersions(actor, article.id),
      listComments(actor, article.id),
      isAdmin
        ? listIssues(actor)
        : Promise.resolve([]),
      db
        .select({ id: users.id, displayName: users.displayName, penName: users.penName })
        .from(users)
        .where(and(inArray(users.role, ["writer", "editor", "admin"]), isNull(users.deletedAt)))
        .orderBy(users.displayName),
      allMediaLicensed(article.id),
    ]);

  const preview = await renderMarkdown(article.bodyMarkdown);

  return (
    <>
      <PageHeader
        title={article.title}
        description={`/${article.slug}`}
        actions={<StatusBadge status={article.status} />}
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Durum</h2>

          {!licensed && (
            <div className="mb-4">
              <Alert tone="warning">
                Bağlı görsellerden birinin lisans bilgisi eksik. Bu makale yayına alınamaz.
              </Alert>
            </div>
          )}

          {grant && (
            <div className="mb-4">
              <Alert tone={grant.status === "signed" ? "success" : "warning"}>
                Eser Onayı: <strong>{grant.status}</strong>
                {grant.signedAt && ` · onay: ${formatDateTime(grant.signedAt)}`}
                {grant.bylineChoice &&
                  ` · yayın adı: ${grant.bylineChoice === "pen_name" ? "mahlas" : "gerçek ad"}`}
                {grant.declinedReason && ` · ret gerekçesi: ${grant.declinedReason}`}
              </Alert>
            </div>
          )}

          <StatusPanel
            action={transitionArticleAction}
            csrfToken={csrfToken}
            articleId={article.id}
            currentStatus={article.status}
            targets={targets}
          />
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Makale</h2>

          <PanelForm action={updateArticleAction} csrfToken={csrfToken} submitLabel="Kaydet">
              <>
                <input type="hidden" name="articleId" value={article.id} />

                <Field label="Başlık" htmlFor="title">
                  <Input id="title" name="title" defaultValue={article.title} required />
                </Field>

                <Field label="Özet" htmlFor="summary">
                  <Input id="summary" name="summary" defaultValue={article.summary ?? ""} />
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Yazar" htmlFor="authorId">
                    <Select id="authorId" name="authorId" defaultValue={article.authorId ?? ""}>
                      <option value="">Atanmadı</option>
                      {writers.map((writer) => (
                        <option key={writer.id} value={writer.id}>
                          {writer.penName ?? writer.displayName}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {isAdmin && (
                    <Field label="Sayı" htmlFor="issueId">
                      <Select id="issueId" name="issueId" defaultValue={article.issueId ?? ""}>
                        <option value="">Atanmadı</option>
                        {issues.map((issue) => (
                          <option key={issue.id} value={issue.id}>
                            Sayı {issue.number} · {issue.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  <Field label="Kategori" htmlFor="category">
                    <Input id="category" name="category" defaultValue={article.category ?? ""} />
                  </Field>

                  <Field label="Teslim tarihi" htmlFor="dueDate">
                    <Input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      defaultValue={article.dueDate ?? ""}
                    />
                  </Field>
                </div>

                <Field label="Gövde (markdown)" htmlFor="bodyMarkdown">
                  <Textarea
                    id="bodyMarkdown"
                    name="bodyMarkdown"
                    rows={16}
                    defaultValue={article.bodyMarkdown}
                  />
                </Field>

                <Field
                  label="Değişiklik notu"
                  htmlFor="changeNote"
                  hint="Gövde değiştiyse sürüm geçmişine yazılır."
                >
                  <Input id="changeNote" name="changeNote" />
                </Field>

                <Field
                  label="Değişikliğin türü"
                  htmlFor="changeKind"
                  hint="İçerik değişikliği yazarın onayını iptal eder ve yeni Eser Onayı ister (Sözleşme m. 6.3)."
                >
                  <Select id="changeKind" name="changeKind" defaultValue="correction">
                    <option value="correction">
                      Düzeltme — yazım, noktalama, dil, biçim (m. 4.2 kapsamında)
                    </option>
                    <option value="content_change">
                      İçerik değişikliği — anlam, üslup veya yapı değişti
                    </option>
                  </Select>
                </Field>
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Önizleme</h2>
          <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">İntihal kontrolü</h2>

          <PanelForm
            action={setPlagiarismAction}
            csrfToken={csrfToken}
            submitLabel="Kaydet"
            submitVariant="secondary"
          >
              <>
                <input type="hidden" name="articleId" value={article.id} />
                <Field label="Durum" htmlFor="plagiarismStatus">
                  <Select
                    id="plagiarismStatus"
                    name="status"
                    defaultValue={article.plagiarismCheckStatus}
                  >
                    <option value="not_run">Kontrol edilmedi</option>
                    <option value="clean">Temiz</option>
                    <option value="flagged">İşaretlendi</option>
                  </Select>
                </Field>
                <Field label="Not" htmlFor="plagiarismNote">
                  <Textarea
                    id="plagiarismNote"
                    name="note"
                    defaultValue={article.plagiarismNote ?? ""}
                  />
                </Field>
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Editöryal notlar</h2>

          {comments.length === 0 ? (
            <EmptyState>Not yok.</EmptyState>
          ) : (
            <ul className="mb-5 space-y-2.5 text-sm">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-md bg-paper px-3 py-2">
                  <p className="whitespace-pre-wrap">{comment.body}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span>
                      {comment.authorName ?? "Editör"} · {formatDate(comment.createdAt)}
                    </span>
                    {comment.resolvedAt ? (
                      <span className="text-accent">çözüldü</span>
                    ) : (
                      <ActionButton
                        action={resolveCommentAction}
                        csrfToken={csrfToken}
                        label="Çözüldü"
                        fields={{ commentId: comment.id, articleId: article.id }}
                      />
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <PanelForm
            action={addCommentAction}
            csrfToken={csrfToken}
            submitLabel="Not ekle"
            submitVariant="secondary"
          >
              <>
                <input type="hidden" name="articleId" value={article.id} />
                <Field label="Yeni not" htmlFor="body">
                  <Textarea id="body" name="body" required minLength={2} />
                </Field>
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Sürüm geçmişi</h2>

          {versions.length === 0 ? (
            <EmptyState>Sürüm kaydı yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Sürüm</Th>
                  <Th>Tarih</Th>
                  <Th>Not</Th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <Td>
                      v{version.version}
                      {version.isPublishedSnapshot && (
                        <span className="ml-2 text-xs text-accent">yayın</span>
                      )}
                    </Td>
                    <Td className="text-xs">{formatDateTime(version.createdAt)}</Td>
                    <Td className="text-xs">{version.changeNote ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <p className="text-sm">
          <Link href="/editor/articles" className="text-muted underline hover:text-ink">
            Makale listesine dön
          </Link>
        </p>
      </div>
    </>
  );
}
