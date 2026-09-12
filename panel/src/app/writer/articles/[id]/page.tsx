import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { articleComments, users } from "@/db/schema";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { findArticleById, listArticleVersions } from "@/services/articles";
import { selectableWriterCategories } from "@/services/editor-categories";
import { listWriterAreasWithQuota } from "@/services/writer-areas";
import { readCsrfToken } from "@/lib/csrf";
import { renderMarkdown } from "@/lib/markdown";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Table, Td, Textarea, Th } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { submitArticleAction, updateArticleAsWriterAction } from "../../actions";

export const metadata = { title: "Yazı" };

export default async function WriterArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await guardWriterInnerPages();
  const { id } = await params;
  const csrfToken = (await readCsrfToken()) ?? "";

  const article = await findArticleById(id);
  if (article.authorId !== user.id) notFound();

  const editable = article.status === "draft" || article.status === "revision_requested";
  const [categories, areas, versions, notes] = await Promise.all([
    editable ? selectableWriterCategories({ ...user }) : Promise.resolve([]),
    editable ? listWriterAreasWithQuota() : Promise.resolve([]),
    listArticleVersions({ ...user }, id),
    db
      .select({
        id: articleComments.id,
        body: articleComments.body,
        createdAt: articleComments.createdAt,
        resolvedAt: articleComments.resolvedAt,
        authorName: users.displayName,
      })
      .from(articleComments)
      .leftJoin(users, eq(articleComments.authorId, users.id))
      .where(inArray(articleComments.articleId, [id])),
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
        {article.status === "revision_requested" && (
          <Alert tone="warning" title="Revizyon istendi">
            Editör değişiklik istedi. Metni düzenleyip yeniden incelemeye
            gönderebilirsiniz.
          </Alert>
        )}

        {editable && (
          <>
            <Card>
              <h2 className="mb-4 font-serif text-lg">Yazı</h2>

              <PanelForm action={updateArticleAsWriterAction} csrfToken={csrfToken} submitLabel="Taslağı kaydet">
                <>
                  <input type="hidden" name="articleId" value={article.id} />

                  <Field label="Başlık" htmlFor="title">
                    <Input id="title" name="title" defaultValue={article.title} required />
                  </Field>

                  <Field
                    label="Slug"
                    htmlFor="slug"
                    hint="Boş bırakılırsa başlıktan üretilir. Küçük harf, rakam ve tire kullanın."
                  >
                    <Input id="slug" name="slug" defaultValue={article.slug} maxLength={120} />
                  </Field>

                  <Field label="Özet" htmlFor="summary">
                    <Input id="summary" name="summary" defaultValue={article.summary ?? ""} />
                  </Field>

                  <Field
                    label="Kategori"
                    htmlFor="category"
                    hint="Yalnızca size tanımlı alanları seçebilirsiniz."
                  >
                    <Select id="category" name="category" defaultValue={article.category ?? ""}>
                      <option value="">Seçin…</option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="Alt köşe"
                    htmlFor="subcategory"
                    hint="İsteğe bağlı; yazının ikincil köşesi (11 ana kategoriden)."
                  >
                    <Select id="subcategory" name="subcategory" defaultValue={article.subcategory ?? ""}>
                      <option value="">Yok</option>
                      {areas.map((area) => (
                        <option key={area.name} value={area.name}>
                          {area.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

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
                </>
              </PanelForm>
            </Card>

            <Card>
              <h2 className="mb-4 font-serif text-lg">İncelemeye gönder</h2>
              <p className="mb-4 text-sm text-muted">
                Yazı, seçtiğiniz kategorinin editörüne düşer; editör onayladıktan
                sonra ana editör, son olarak yönetici inceleyecektir.
              </p>
              <PanelForm action={submitArticleAction} csrfToken={csrfToken} submitLabel="İncelemeye gönder">
                <input type="hidden" name="articleId" value={article.id} />
              </PanelForm>
            </Card>
          </>
        )}

        {!editable && (
          <Card>
            <h2 className="mb-2 font-serif text-lg">Durum</h2>
            <p className="text-sm text-muted">
              Yazınız şu anda inceleme zincirinde. Metni ancak editörler
              düzenleyebilir; durum değişikliklerini ve editör notlarını
              buradan izleyebilirsiniz.
            </p>
          </Card>
        )}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Editör notları</h2>
          {notes.length === 0 ? (
            <EmptyState>Not yok.</EmptyState>
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

        {preview && (
          <Card>
            <h2 className="mb-4 font-serif text-lg">Önizleme</h2>
            <div className="prose-panel text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
          </Card>
        )}

        <p className="text-sm">
          <Link href="/writer/articles" className="text-muted underline hover:text-ink">
            Yazılarıma dön
          </Link>
        </p>
      </div>
    </>
  );
}