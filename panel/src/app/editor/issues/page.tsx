import { guardPanel } from "@/lib/auth/guard";
import { listIssueArticles, listIssues } from "@/services/issues";
import { listMedia } from "@/services/media";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import {
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { IssueOrder } from "./issue-order";
import {
  createIssueAction,
  reorderIssueArticlesAction,
  setIssueStatusAction,
  updateIssueAction,
} from "../actions";

export const metadata = { title: "Sayılar" };

export default async function EditorIssuesPage() {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  const csrfToken = (await readCsrfToken()) ?? "";

  const issues = await listIssues(actor);
  const covers = await listMedia(actor, 100);
  const contents = await Promise.all(
    issues.map(async (issue) => ({ issue, articles: await listIssueArticles(issue.id) })),
  );

  const nextNumber = (issues[0]?.number ?? 0) + 1;

  return (
    <>
      <PageHeader title="Sayılar" description="Sayı planlama, kapak, sıralama ve yayın." />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 font-serif text-lg">Yeni sayı</h2>

          <PanelForm action={createIssueAction} csrfToken={csrfToken} submitLabel="Sayı oluştur">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Numara" htmlFor="number">
                  <Input
                    id="number"
                    name="number"
                    type="number"
                    min={1}
                    defaultValue={nextNumber}
                    required
                  />
                </Field>

                <Field label="Başlık" htmlFor="title">
                  <Input id="title" name="title" required />
                </Field>

                <Field label="Tema" htmlFor="theme">
                  <Input id="theme" name="theme" />
                </Field>

                <Field label="Planlanan yayın tarihi" htmlFor="plannedPublishDate">
                  <Input id="plannedPublishDate" name="plannedPublishDate" type="date" />
                </Field>
              </div>
          </PanelForm>
        </Card>

        {contents.length === 0 ? (
          <EmptyState>Henüz sayı yok.</EmptyState>
        ) : (
          contents.map(({ issue, articles }) => (
            <Card key={issue.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-lg">
                  Sayı {issue.number} · {issue.title}
                </h2>
                <StatusBadge status={issue.status} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-medium">Bilgiler</h3>

                  <PanelForm
                    action={updateIssueAction}
                    csrfToken={csrfToken}
                    submitLabel="Kaydet"
                    submitVariant="secondary"
                  >
                      <>
                        <input type="hidden" name="issueId" value={issue.id} />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Numara" htmlFor={`number-${issue.id}`}>
                            <Input
                              id={`number-${issue.id}`}
                              name="number"
                              type="number"
                              min={1}
                              defaultValue={issue.number}
                              required
                            />
                          </Field>

                          <Field label="Başlık" htmlFor={`title-${issue.id}`}>
                            <Input
                              id={`title-${issue.id}`}
                              name="title"
                              defaultValue={issue.title}
                              required
                            />
                          </Field>
                        </div>

                        <Field label="Tema" htmlFor={`theme-${issue.id}`}>
                          <Input
                            id={`theme-${issue.id}`}
                            name="theme"
                            defaultValue={issue.theme ?? ""}
                          />
                        </Field>

                        <Field label="Kapak görseli" htmlFor={`cover-${issue.id}`}>
                          <Select
                            id={`cover-${issue.id}`}
                            name="coverMediaId"
                            defaultValue={issue.coverMediaId ?? ""}
                          >
                            <option value="">Kapak yok</option>
                            {covers.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.altText ?? item.storageKey}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Planlanan yayın" htmlFor={`planned-${issue.id}`}>
                          <Input
                            id={`planned-${issue.id}`}
                            name="plannedPublishDate"
                            type="date"
                            defaultValue={issue.plannedPublishDate ?? ""}
                          />
                        </Field>
                      </>
                  </PanelForm>

                  <div className="mt-5 border-t border-line pt-4">
                    <PanelForm
                      action={setIssueStatusAction}
                      csrfToken={csrfToken}
                      submitLabel="Durumu değiştir"
                      submitVariant="secondary"
                    >
                        <>
                          <input type="hidden" name="issueId" value={issue.id} />
                          <Field label="Durum" htmlFor={`status-${issue.id}`}>
                            <Select
                              id={`status-${issue.id}`}
                              name="status"
                              defaultValue={issue.status}
                            >
                              <option value="planning">Planlanıyor</option>
                              <option value="in_production">Üretimde</option>
                              <option value="published">Yayınlandı</option>
                              <option value="archived">Arşivlendi</option>
                            </Select>
                          </Field>
                        </>
                    </PanelForm>
                  </div>

                  {issue.publishedAt && (
                    <p className="mt-3 text-xs text-muted">
                      Yayın tarihi: {formatDate(issue.publishedAt)}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium">İçindekiler</h3>
                  <IssueOrder
                    action={reorderIssueArticlesAction}
                    csrfToken={csrfToken}
                    issueId={issue.id}
                    articles={articles.map((article) => ({
                      id: article.id,
                      title: article.title,
                      status: article.status,
                    }))}
                  />
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
