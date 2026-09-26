import Link from "next/link";
import { forbidden } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { canReviewTopicProposals } from "@/lib/auth/rbac";
import { readCsrfToken } from "@/lib/csrf";
import { formatDateTime } from "@/lib/utils";
import { getEditorAssignment } from "@/services/editor-categories";
import { listIssues } from "@/services/issues";
import { listTopicProposals } from "@/services/topics";
import { PanelForm } from "@/components/form";
import { IssueWindows } from "@/components/issue-windows";
import { Card, EmptyState, Field, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import type { TopicProposalStatus } from "@/db/schema";
import { decideTopicAction } from "../actions";

export const metadata = { title: "Konu önerileri" };

const STATUSES: { value: TopicProposalStatus; label: string }[] = [
  { value: "submitted", label: "Değerlendirme bekleyen" },
  { value: "revision_requested", label: "Değişiklik istenen" },
  { value: "accepted", label: "Kabul edilen" },
  { value: "rejected", label: "Reddedilen" },
];

const EVENT_LABELS: Record<string, string> = {
  submitted: "Gönderildi",
  resubmitted: "Yeniden gönderildi",
  accepted: "Kabul edildi",
  revision_requested: "Değişiklik istendi",
  rejected: "Reddedildi",
};

/**
 * The topic proposals of each issue, and the main editor's decision on them
 * (D-261). Only a main editor or an admin may be here; a category editor is
 * refused by the same rule the service applies to every decision.
 */
export default async function TopicProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sayi?: string; durum?: string }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  if (!canReviewTopicProposals(actor, await getEditorAssignment(user.id))) forbidden();

  const params = await searchParams;
  const [issues, csrfToken] = await Promise.all([listIssues(actor), readCsrfToken()]);
  const issue = issues.find((row) => String(row.number) === params.sayi) ?? null;
  const status = STATUSES.find((row) => row.value === params.durum)?.value;

  const proposals = await listTopicProposals(actor, { issueId: issue?.id, status });
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Konu önerileri"
        description="Yazarların sayılar için gönderdiği konular. Kabul edin, değişiklik isteyin ya da reddedin; her adım geçmişte kalır."
      />

      <div className="space-y-6">
        <Card>
          {/* A plain GET form: filtering changes nothing */}
          <form method="get" className="grid gap-3 sm:grid-cols-3">
            <Field label="Sayı" htmlFor="sayi">
              <Select id="sayi" name="sayi" defaultValue={params.sayi ?? ""}>
                <option value="">Tüm sayılar</option>
                {issues.map((row) => (
                  <option key={row.id} value={row.number}>
                    Sayı {row.number} · {row.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Durum" htmlFor="durum">
              <Select id="durum" name="durum" defaultValue={status ?? ""}>
                <option value="">Tümü</option>
                {STATUSES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-10 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-paper"
              >
                Süz
              </button>
            </div>
          </form>
          {issue && (
            <div className="mt-4">
              <IssueWindows issue={issue} now={now} />
            </div>
          )}
        </Card>

        {proposals.length === 0 ? (
          <EmptyState>Bu seçime uyan konu önerisi yok.</EmptyState>
        ) : (
          proposals.map(({ proposal, issueNumber, authorName, authorPenName, authorInactive, events }) => (
            <Card key={proposal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs tracking-wide text-muted uppercase">
                    Sayı {issueNumber}
                    {proposal.category ? ` · ${proposal.category}` : ""}
                  </p>
                  <h2 className="mt-1 font-serif text-lg break-words">{proposal.title}</h2>
                  <p className="mt-1 text-sm">
                    {authorPenName ?? authorName}
                    {authorInactive && <span className="ml-2 text-xs text-warning">(pasif hesap)</span>}
                    <span className="text-muted"> · {formatDateTime(proposal.submittedAt)}</span>
                  </p>
                </div>
                <StatusBadge status={`topic_${proposal.status}`} />
              </div>

              <p className="mt-3 text-sm whitespace-pre-wrap">{proposal.description}</p>

              {proposal.editorNote && (
                <p className="mt-3 rounded-md border border-line bg-paper px-3 py-2 text-sm">
                  <span className="font-medium">Son not:</span> {proposal.editorNote}
                </p>
              )}

              {events.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">Geçmiş ({events.length})</summary>
                  <ol className="mt-2 space-y-2 border-l border-line pl-4">
                    {events.map((event) => (
                      <li key={event.id}>
                        <span className="font-medium">{EVENT_LABELS[event.kind] ?? event.kind}</span>
                        <span className="text-muted">
                          {" "}
                          · sürüm {event.version} · {event.actorName ?? "—"} · {formatDateTime(event.createdAt)}
                        </span>
                        {(event.kind === "submitted" || event.kind === "resubmitted") && (
                          <p className="text-xs text-muted">„{event.title}“</p>
                        )}
                        {event.note && <p className="text-xs">Not: {event.note}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {proposal.status === "submitted" &&
                (proposal.authorId === user.id ? (
                  <p className="mt-4 text-sm text-muted">Kendi konunuzu değerlendiremezsiniz.</p>
                ) : (
                  <div className="mt-4 border-t border-line pt-4">
                    <PanelForm action={decideTopicAction} csrfToken={csrfToken ?? ""} submitLabel="Kararı kaydet">
                      <input type="hidden" name="proposalId" value={proposal.id} />
                      {/* The version this page saw: a decision made meanwhile in another tab wins */}
                      <input type="hidden" name="version" value={proposal.version} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Karar" htmlFor={`decision-${proposal.id}`}>
                          <Select id={`decision-${proposal.id}`} name="decision" defaultValue="accept">
                            <option value="accept">Kabul et</option>
                            <option value="revision">Değişiklik iste</option>
                            <option value="reject">Reddet</option>
                          </Select>
                        </Field>
                        <div className="sm:col-span-2">
                          <Field
                            label="Yazara not"
                            htmlFor={`note-${proposal.id}`}
                            hint="Değişiklik isterken ve reddederken zorunlu; yazar bu notu görür."
                          >
                            <Textarea id={`note-${proposal.id}`} name="note" rows={3} maxLength={2000} />
                          </Field>
                        </div>
                      </div>
                    </PanelForm>
                  </div>
                ))}
            </Card>
          ))
        )}

        {/* The issues page is the admin's (D-059); a main editor would meet a 403 there */}
        {user.role === "admin" && (
          <p className="text-xs text-muted">
            Dönem tarihleri <Link href="/editor/issues" className="underline">Sayılar</Link> sayfasından
            yönetilir.
          </p>
        )}
      </div>
    </>
  );
}
