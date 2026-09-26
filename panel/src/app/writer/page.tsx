import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { pendingAcknowledgements } from "@/services/announcements";
import { listApprovalsForWriter } from "@/services/rights";
import { listArticlesForWriter } from "@/services/articles";
import { getCurrentAgreement, listAcceptancesForUser } from "@/services/agreements";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { canProposeTopics } from "@/lib/auth/rbac";
import { periodState, submissionPeriod, topicPeriod } from "@/lib/issue-periods";
import { writerStage, WRITER_STAGE_TEXT } from "@/lib/topic-stage";
import { isIssueInProgress, listWriterIssues } from "@/services/topics";
import { IssueWindows } from "@/components/issue-windows";

export const metadata = { title: "Yazar paneli" };

export default async function WriterDashboard() {
  const { user } = await guardPanel("writer");

  const [pending, approvals, articles, current, acceptances, issueEntries] = await Promise.all([
    pendingAcknowledgements({ ...user }),
    listApprovalsForWriter({ ...user }),
    listArticlesForWriter({ ...user }),
    getCurrentAgreement(),
    listAcceptancesForUser(user.id),
    canProposeTopics({ ...user }) ? listWriterIssues({ ...user }) : Promise.resolve([]),
  ]);
  const now = new Date();
  // The issues whose process is running, shown first and loud (D-261)
  const running = issueEntries.filter((entry) => isIssueInProgress(entry.issue, now));

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const agreementAccepted =
    current !== null && acceptances.some((row) => row.version === current.version);

  return (
    <>
      <PageHeader
        title={`Merhaba, ${user.displayName}`}
        description="Sizden beklenen işler ve yazılarınızın durumu."
      />

      <div className="space-y-6">
        {user.writerStatus !== "active" && (
          <Alert tone="warning" title="Yazar sayfalarınız kilitli">
            {user.writerStatus === "suspended"
              ? "Yazarlığınız askıya alınmış. Bir yöneticiye başvurun."
              : "Güncel çerçeve sözleşmeyi onayladığınızda tüm yazar sayfalarınız açılacak."}{" "}
            <Link href="/writer/agreement" className="underline">
              Sözleşmeye git
            </Link>
          </Alert>
        )}

        {user.penName === null && (
          <Alert tone="warning" title="Mahlasınız yok">
            Yazınız yayına girdiğinde künyesinde <strong>mahlasınız</strong> yazar. Mahlas
            belirlemezseniz yazı <strong>isimsiz</strong> yayımlanır — devir formunda
            açıkça gerçek adınızı seçmediğiniz sürece — ve okurun gidebileceği bir yazar
            sayfanız olmaz.{" "}
            <Link href="/account" className="underline">
              Hesabımdan mahlas belirleyin
            </Link>
          </Alert>
        )}

        {pending.length > 0 && (
          <Alert tone="warning" title="Onayınız bekleyen duyuru var">
            <Link href="/writer/announcements" className="underline">
              {pending.length} duyuru
            </Link>{" "}
            onaylanmadan diğer sayfalar açılmaz.
          </Alert>
        )}

        {running.map(({ issue, proposal, articles: issueArticles }) => {
          const article = proposal?.articleId
            ? (issueArticles.find((row) => row.id === proposal.articleId) ?? null)
            : null;
          const stage = writerStage({
            topicState: periodState(topicPeriod(issue), now),
            submissionState: periodState(submissionPeriod(issue), now),
            proposalStatus: proposal?.status ?? null,
            articleStatus: article?.status ?? null,
          });
          return (
            <Card key={issue.id} className="border-accent/40">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-lg">
                  Sayı {issue.number} · {issue.title}
                </h2>
                <StatusBadge status={stage} />
              </div>
              <IssueWindows issue={issue} now={now} />
              <p className="mt-3 text-sm">
                {WRITER_STAGE_TEXT[stage]}{" "}
                <Link href="/writer/topics" className="text-accent underline">
                  {stage === "topic_missing" ? "Konu Belirle" : "Ayrıntılar"}
                </Link>
              </p>
            </Card>
          );
        })}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-serif text-lg">Sözleşme</h2>
            {current === null ? (
              <p className="text-sm text-muted">Henüz yayınlanmış bir çerçeve sözleşme yok.</p>
            ) : agreementAccepted ? (
              <p className="text-sm">
                Sürüm {current.version} onaylandı.{" "}
                <Link href="/writer/agreement" className="text-accent underline">
                  Görüntüle
                </Link>
              </p>
            ) : (
              <p className="text-sm">
                Sürüm {current.version} onayınızı bekliyor.{" "}
                <Link href="/writer/agreement" className="text-accent underline">
                  Oku ve onayla
                </Link>
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-lg">Bekleyen Eser Onayları</h2>
            {pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted">Onayınızı bekleyen eser yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pendingApprovals.map((approval) => (
                  <li key={approval.id}>
                    <Link href="/writer/approvals" className="text-accent underline">
                      {approval.articleTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Teslim takvimi</h2>
          {articles.length === 0 ? (
            <EmptyState>Size atanmış makale yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {articles.map((article) => (
                <li key={article.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">{article.title}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    {article.dueDate && (
                      <span className="text-xs text-muted">
                        Teslim: {formatDate(article.dueDate)}
                      </span>
                    )}
                    <StatusBadge status={article.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
