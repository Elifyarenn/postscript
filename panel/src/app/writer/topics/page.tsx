import Link from "next/link";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { canProposeTopics, canWriteInAnyArea } from "@/lib/auth/rbac";
import { readCsrfToken } from "@/lib/csrf";
import {
  formatPeriodMoment,
  periodState,
  submissionPeriod,
  topicPeriod,
} from "@/lib/issue-periods";
import { writerStage, WRITER_STAGE_TEXT } from "@/lib/topic-stage";
import { formatDateTime } from "@/lib/utils";
import { isIssueInProgress, listWriterIssues, mayResubmit } from "@/services/topics";
import { PanelForm } from "@/components/form";
import { IssueWindows } from "@/components/issue-windows";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import type { TopicProposal } from "@/db/schema";
import { reviseTopicAction, submitTopicAction } from "../actions";

export const metadata = { title: "Sayılar ve konular" };

const EVENT_LABELS: Record<string, string> = {
  submitted: "gönderildi",
  resubmitted: "yeniden gönderildi",
  accepted: "kabul edildi",
  revision_requested: "değişiklik istendi",
  rejected: "reddedildi",
};

/**
 * The topic form, empty for a new topic or filled for a revision. A writer with
 * two areas must name the area, since each area takes its own topic (D-271).
 */
function TopicFields({
  categories,
  proposal,
  requireArea,
  formKey,
}: {
  categories: string[];
  proposal: TopicProposal | null;
  requireArea: boolean;
  formKey: string;
}) {
  const key = proposal?.id ?? formKey;
  return (
    <>
      <Field label="Konu başlığı" htmlFor={`topic-title-${key}`}>
        <Input
          id={`topic-title-${key}`}
          name="title"
          required
          minLength={3}
          maxLength={200}
          defaultValue={proposal?.title ?? ""}
        />
      </Field>
      <Field label="Kısa açıklama" htmlFor={`topic-description-${key}`} hint="Ne anlatacağınızı birkaç cümleyle yazın.">
        <Textarea
          id={`topic-description-${key}`}
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          defaultValue={proposal?.description ?? ""}
        />
      </Field>
      {categories.length > 0 && (
        <Field label="Alan" htmlFor={`topic-category-${key}`}>
          <Select
            id={`topic-category-${key}`}
            name="category"
            required={requireArea}
            defaultValue={proposal?.category ?? (requireArea && categories.length === 1 ? categories[0] : "")}
          >
            <option value="" disabled={requireArea}>
              {requireArea ? "Alan seçin" : "Seçmedim"}
            </option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </>
  );
}

/**
 * The writer's side of the issue process (D-261): the running issues first,
 * each with its windows, the writer's topic and what to do next; then the
 * past issues. Every rule shown here is checked again by the server.
 */
export default async function WriterTopicsPage() {
  const { user } = await guardWriterInnerPages();
  const actor = { ...user };

  if (!canProposeTopics(actor)) {
    return (
      <>
        <PageHeader title="Sayılar ve konular" />
        <EmptyState>Konu önermek için etkin bir yazarlık gerekir.</EmptyState>
      </>
    );
  }

  const [entries, csrfToken] = await Promise.all([
    listWriterIssues(actor),
    readCsrfToken().then((token) => token ?? ""),
  ]);
  // An admin holds no area and may pick any of them (D-304)
  const anyArea = canWriteInAnyArea(actor);
  const now = new Date();
  const running = entries.filter((entry) => isIssueInProgress(entry.issue, now));
  const past = entries.filter((entry) => !isIssueInProgress(entry.issue, now));

  return (
    <>
      <PageHeader
        title="Sayılar ve konular"
        description="Her sayı için önce konunuzu belirlersiniz; editör kabul edince yazınızı yazar ve yazı kabul döneminde teslim edersiniz. Saatler Türkiye saatidir."
      />

      <div className="space-y-6">
        {running.length === 0 && (
          <EmptyState>Şu anda konu ya da yazı kabul eden bir sayı yok.</EmptyState>
        )}

        {/* Each issue has its own areas: one given for that issue only counts there (D-306) */}
        {running.map(({ issue, proposals, areas: categories, openAreas, canProposeMore, articles }) => {
          const topicState = periodState(topicPeriod(issue), now);
          const submissionState = periodState(submissionPeriod(issue), now);
          // Two areas: each topic names its area, so the form offers only the free ones (D-271)
          const requireArea = categories.length >= 2;
          const emptyStage = writerStage({
            topicState,
            submissionState,
            proposalStatus: null,
            articleStatus: null,
          });

          return (
            <Card key={issue.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-lg">
                  Sayı {issue.number} · {issue.title}
                </h2>
                {proposals.length === 0 && <StatusBadge status={emptyStage} />}
              </div>

              <IssueWindows issue={issue} now={now} />

              {proposals.length === 0 && (
                <p className="mt-4 text-sm font-medium">{WRITER_STAGE_TEXT[emptyStage]}</p>
              )}

              {/* No topic yet */}
              {proposals.length === 0 && topicState === "upcoming" && issue.topicOpensAt && (
                <p className="mt-2 text-sm text-muted">
                  Konu gönderimi {formatPeriodMoment(issue.topicOpensAt)}&apos;de açılır.
                </p>
              )}

              {/* One block per topic: a writer with two areas may hold two */}
              {proposals.map(({ proposal, events }) => {
                const article = proposal.articleId
                  ? (articles.find((row) => row.id === proposal.articleId) ?? null)
                  : null;
                const stage = writerStage({
                  topicState,
                  submissionState,
                  proposalStatus: proposal.status,
                  articleStatus: article?.status ?? null,
                });

                return (
                  <section key={proposal.id} className="mt-5 border-t border-line pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">
                        {proposal.category ? `Konunuz · ${proposal.category}` : "Konunuz"}
                      </h3>
                      <StatusBadge status={stage} />
                    </div>
                    <p className="mt-1 text-sm">{WRITER_STAGE_TEXT[stage]}</p>

                    <div className="mt-3 rounded-md border border-line bg-paper px-4 py-3 text-sm">
                      <p className="font-medium break-words">{proposal.title}</p>
                      <p className="mt-2 whitespace-pre-wrap">{proposal.description}</p>
                      <p className="mt-2 text-xs text-muted">Gönderim: {formatDateTime(proposal.submittedAt)}</p>
                    </div>

                    {proposal.editorNote &&
                      (proposal.status === "revision_requested" || proposal.status === "rejected") && (
                        <div className="mt-4">
                          <Alert tone={proposal.status === "rejected" ? "danger" : "warning"} title="Editörün notu">
                            <span className="whitespace-pre-wrap">{proposal.editorNote}</span>
                          </Alert>
                        </div>
                      )}

                    {proposal.status === "revision_requested" &&
                      (mayResubmit(issue, now) ? (
                        <div className="mt-4">
                          <h4 className="mb-3 text-sm font-medium">Konuyu düzenle ve yeniden gönder</h4>
                          <PanelForm action={reviseTopicAction} csrfToken={csrfToken} submitLabel="Yeniden gönder">
                            <input type="hidden" name="proposalId" value={proposal.id} />
                            <input type="hidden" name="version" value={proposal.version} />
                            <TopicFields
                              categories={
                                requireArea
                                  ? [...(proposal.category ? [proposal.category] : []), ...openAreas]
                                  : categories
                              }
                              proposal={proposal}
                              requireArea={requireArea}
                              formKey={proposal.id}
                            />
                          </PanelForm>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted">Bu sayının süresi doldu; konu yeniden gönderilemez.</p>
                      ))}

                    {proposal.status === "accepted" && (
                      <p className="mt-4 text-sm">
                        {article ? (
                          <Link href={`/writer/articles/${article.id}`} className="text-accent underline">
                            Yazınıza gidin: {article.title}
                          </Link>
                        ) : submissionState === "closed" ? (
                          <span className="text-muted">Yazı kabul süresi doldu.</span>
                        ) : (
                          <Link
                            href={`/writer/articles/new?konu=${proposal.id}`}
                            className="inline-flex min-h-10 items-center rounded-md border border-accent bg-accent px-4 py-2 font-medium text-white hover:bg-accent/90"
                          >
                            Yazıya başla
                          </Link>
                        )}
                      </p>
                    )}

                    {events.length > 1 && (
                      <details className="mt-4 text-sm">
                        <summary className="cursor-pointer text-muted">Konu geçmişi ({events.length})</summary>
                        <ol className="mt-2 space-y-1 border-l border-line pl-4 text-xs">
                          {events.map((event) => (
                            <li key={event.id}>
                              {formatDateTime(event.createdAt)} · {EVENT_LABELS[event.kind] ?? event.kind}
                              {event.note && <span className="text-muted"> — {event.note}</span>}
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </section>
                );
              })}

              {/* A new topic: the first one, or one for an area still without a topic */}
              {topicState === "open" && canProposeMore && (!requireArea || openAreas.length > 0) && (
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="mb-3 text-sm font-medium">
                    {proposals.length === 0
                      ? "Konu Belirle"
                      : anyArea
                        ? "Başka bir alan için konu belirleyin"
                        : `Diğer alanınız için konu belirleyin (${openAreas.join(", ")})`}
                  </h3>
                  <PanelForm action={submitTopicAction} csrfToken={csrfToken} submitLabel="Konuyu gönder">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <TopicFields
                      categories={requireArea ? openAreas : categories}
                      proposal={null}
                      requireArea={requireArea}
                      formKey={`new-${issue.id}`}
                    />
                  </PanelForm>
                </div>
              )}
            </Card>
          );
        })}

        {past.length > 0 && (
          <Card>
            <h2 className="mb-3 font-serif text-lg">Geçmiş sayılar</h2>
            <ul className="divide-y divide-line text-sm">
              {past.map(({ issue, proposals, articles }) => (
                <li key={issue.id} className="py-3">
                  <p className="font-medium">
                    Sayı {issue.number} · {issue.title}
                  </p>
                  {proposals.map(({ proposal }) => (
                    <p key={proposal.id} className="mt-1 flex flex-wrap items-center gap-2 text-muted">
                      Konu: {proposal.title}
                      {proposal.category && ` (${proposal.category})`}{" "}
                      <StatusBadge status={`topic_${proposal.status}`} />
                    </p>
                  ))}
                  {articles.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {articles.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center gap-2">
                          <Link href={`/writer/articles/${row.id}`} className="text-accent underline">
                            {row.title}
                          </Link>
                          <StatusBadge status={row.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
