import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articleMedia, media, users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import {
  findArticleById,
  listArticleVersions,
  listComments,
} from "@/services/articles";
import { listIssues } from "@/services/issues";
import { findActiveGrant } from "@/services/rights";
import { allMediaLicensed, listMedia } from "@/services/media";
import { allowedTargets } from "@/lib/article-status";
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
  attachMediaAction,
  detachMediaAction,
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
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  const article = await findArticleById(id);

  const [grant, versions, comments, issues, writers, library, licensed, attached] =
    await Promise.all([
      findActiveGrant(article.id),
      listArticleVersions(actor, article.id),
      listComments(actor, article.id),
      listIssues(actor),
      db
        .select({ id: users.id, displayName: users.displayName, penName: users.penName })
        .from(users)
        .where(and(inArray(users.role, ["writer", "editor", "admin"]), isNull(users.deletedAt)))
        .orderBy(users.displayName),
      listMedia(actor, 100),
      allMediaLicensed(article.id),
      db
        .select({
          id: media.id,
          storageKey: media.storageKey,
          licenseType: media.licenseType,
          altText: media.altText,
        })
        .from(articleMedia)
        .innerJoin(media, eq(articleMedia.mediaId, media.id))
        .where(eq(articleMedia.articleId, article.id)),
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
                Hak devri formu: <strong>{grant.status}</strong>
                {grant.signedAt && ` · imza: ${formatDateTime(grant.signedAt)}`}
                {grant.declinedReason && ` · ret gerekçesi: ${grant.declinedReason}`}
              </Alert>
            </div>
          )}

          <StatusPanel
            action={transitionArticleAction}
            csrfToken={csrfToken}
            articleId={article.id}
            currentStatus={article.status}
            targets={allowedTargets(article.status)}
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

                <Field label="Etiketler" htmlFor="tags" hint="Virgülle ayırın.">
                  <Input id="tags" name="tags" defaultValue={article.tags.join(", ")} />
                </Field>

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
              </>
          </PanelForm>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Önizleme</h2>
          <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Görseller</h2>

          {attached.length === 0 ? (
            <EmptyState>Bu makaleye görsel bağlı değil.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Dosya</Th>
                  <Th>Lisans</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {attached.map((row) => (
                  <tr key={row.id}>
                    <Td className="text-xs">{row.altText ?? row.storageKey}</Td>
                    <Td className="text-xs">
                      {row.licenseType ?? <span className="text-danger">Eksik</span>}
                    </Td>
                    <Td className="text-right">
                      <ActionButton
                        action={detachMediaAction}
                        csrfToken={csrfToken}
                        label="Çıkar"
                        fields={{ articleId: article.id, mediaId: row.id }}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <div className="mt-4">
            <PanelForm
              action={attachMediaAction}
              csrfToken={csrfToken}
              submitLabel="Görsel ekle"
              submitVariant="secondary"
            >
                <>
                  <input type="hidden" name="articleId" value={article.id} />
                  <Field label="Kütüphaneden seç" htmlFor="mediaId">
                    <Select id="mediaId" name="mediaId" required>
                      <option value="">Seçin…</option>
                      {library.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.altText ?? item.storageKey} ({item.licenseType ?? "lisanssız"})
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
            </PanelForm>
          </div>
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
