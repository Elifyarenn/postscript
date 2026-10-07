import Link from "next/link";
import { announceOpenedSubmissionWindowsSoon } from "@/services/issue-mail";
import { guardPanel } from "@/lib/auth/guard";
import { pendingAcknowledgements } from "@/services/announcements";
import { listApprovalsForWriter } from "@/services/rights";
import { listArticlesForWriter } from "@/services/articles";
import { getActiveIssue } from "@/services/active-issue";
import { formatWordCount } from "@/lib/word-count";
import { getCurrentAgreement, hasAcceptedCurrentAgreement } from "@/services/agreements";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { canProposeTopics, needsAuthorAgreement } from "@/lib/auth/rbac";
import { periodState, submissionPeriod, topicPeriod } from "@/lib/issue-periods";
import { writerStage, WRITER_STAGE_TEXT } from "@/lib/topic-stage";
import { listIssueCalendar, listWriterIssues } from "@/services/topics";
import { IssueCalendar } from "@/components/issue-calendar";

export const metadata = { title: "Yazar paneli" };

export default async function WriterDashboard() {
  const { user } = await guardPanel("writer");
  // An admin writes with no writer duty and no contract (D-304, D-305)
  const signsContract = needsAuthorAgreement(user);
  // The Hobby cron runs once a day; a panel visit is what sends this on time (D-270)
  await announceOpenedSubmissionWindowsSoon();

  // The delivery list is the active issue's; older issues are under "Yazılarım" (D-330)
  const activeIssue = await getActiveIssue();
  const [pending, approvals, articles, current, agreementAccepted, issueEntries, calendar] = await Promise.all([
    pendingAcknowledgements({ ...user }),
    activeIssue ? listApprovalsForWriter({ ...user }, activeIssue.id) : Promise.resolve([]),
    activeIssue ? listArticlesForWriter({ ...user }, activeIssue.id) : Promise.resolve([]),
    getCurrentAgreement(),
    // A verified signed contract, not a checkbox (D-275)
    hasAcceptedCurrentAgreement(user.id),
    canProposeTopics({ ...user }) ? listWriterIssues({ ...user }) : Promise.resolve([]),
    listIssueCalendar({ ...user }),
  ]);
  const now = new Date();

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");

  return (
    <>
      <PageHeader
        title={`Merhaba, ${user.displayName}`}
        description="Sizden beklenen işler ve yazılarınızın durumu."
      />

      <div className="space-y-6">
        {signsContract && user.writerStatus !== "active" && (
          <Alert tone="warning" title="Yazar sayfalarınız kilitli">
            {user.writerStatus === "suspended"
              ? "Yazarlığınız askıya alınmış. Bir yöneticiye başvurun."
              : "İmzalı sözleşmeniz doğrulandığında tüm yazar sayfalarınız açılacak."}{" "}
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

        {/* Every writer sees the running issue's calendar first (D-264); an
            active writer also sees where they stand in it (D-261) */}
        <IssueCalendar
          issues={calendar}
          now={now}
          extra={(issue) => {
            const entry = issueEntries.find((row) => row.issue.id === issue.id);
            if (!entry) return null;
            const { proposals, articles: issueArticles, canProposeMore, openAreas } = entry;
            const topicState = periodState(topicPeriod(issue), now);
            const submissionState = periodState(submissionPeriod(issue), now);
            // One line per topic (a writer with two areas may hold two, D-271), and one
            // for an area still without a topic while topics are being taken
            const lines = proposals.map(({ proposal }) => {
              const article = proposal.articleId
                ? (issueArticles.find((row) => row.id === proposal.articleId) ?? null)
                : null;
              return {
                key: proposal.id,
                area: proposal.category,
                stage: writerStage({
                  topicState,
                  submissionState,
                  proposalStatus: proposal.status,
                  articleStatus: article?.status ?? null,
                }),
              };
            });
            if (proposals.length === 0 || (canProposeMore && topicState === "open")) {
              lines.push({
                key: "missing",
                area: proposals.length > 0 ? openAreas.join(", ") || null : null,
                stage: writerStage({ topicState, submissionState, proposalStatus: null, articleStatus: null }),
              });
            }
            return (
              <div className="mt-3 space-y-2">
                {lines.map((line) => (
                  <p key={line.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge status={line.stage} />
                    {line.area && <span className="text-muted">{line.area}:</span>}
                    {WRITER_STAGE_TEXT[line.stage]}
                    <Link href="/writer/topics" className="text-accent underline">
                      {line.stage === "topic_missing" ? "Konu Belirle" : "Ayrıntılar"}
                    </Link>
                  </p>
                ))}
              </div>
            );
          }}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-serif text-lg">Sözleşme</h2>
            {!signsContract ? (
              <p className="text-sm text-muted">Dergiyi kuran yöneticilerden yazar sözleşmesi istenmez.</p>
            ) : current === null ? (
              <p className="text-sm text-muted">Henüz yayınlanmış bir çerçeve sözleşme yok.</p>
            ) : agreementAccepted ? (
              <p className="text-sm">
                Sürüm {current.version}: imzalı sözleşmeniz doğrulandı.{" "}
                <Link href="/writer/agreement" className="text-accent underline">
                  Görüntüle
                </Link>
              </p>
            ) : (
              <p className="text-sm">
                Sürüm {current.version} için imzalı sözleşmeniz bekleniyor.{" "}
                <Link href="/writer/agreement" className="text-accent underline">
                  Sözleşmem
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
          <h2 className="mb-3 font-serif text-lg">
            Teslim takvimi{activeIssue ? ` · Sayı ${activeIssue.number}` : ""}
          </h2>
          {articles.length === 0 ? (
            <EmptyState>Aktif sayıda yazınız yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {articles.map((article) => (
                <li key={article.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">{article.title}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted">{formatWordCount(article.wordCount)}</span>
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
