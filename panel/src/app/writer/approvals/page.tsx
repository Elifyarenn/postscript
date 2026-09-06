import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { articleHash, listApprovalsForWriter, APPROVAL_STATEMENT } from "@/services/rights";
import { getCurrentAgreement, listAcceptancesForUser } from "@/services/agreements";
import { readCsrfToken } from "@/lib/csrf";
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ApprovalRow } from "./approval-row";
import { approveWorkAction, declineWorkAction } from "../actions";

export const metadata = { title: "Eser Onayları" };

export default async function WriterApprovalsPage() {
  const { user } = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const [approvals, current, acceptances] = await Promise.all([
    listApprovalsForWriter({ ...user }),
    getCurrentAgreement(),
    listAcceptancesForUser(user.id),
  ]);

  // §6.4: a pending contract version blocks approvals until it is accepted
  const contractCurrent =
    current !== null && acceptances.some((row) => row.version === current.version);
  const locked = user.writerStatus !== "active" || !contractCurrent;

  const pending = approvals.filter((row) => row.status === "pending");
  const settled = approvals.filter((row) => row.status !== "pending");

  return (
    <>
      <PageHeader
        title="Eser Onayları"
        description="Her eser için ruhsat, burada verdiğiniz onayla doğar (Sözleşme m. 5)."
      />

      <div className="space-y-6">
        {locked && (
          <Alert tone="warning" title="Onay veremezsiniz">
            {user.writerStatus === "suspended"
              ? "Yazarlığınız askıya alınmış."
              : "Güncel sözleşme sürümünü onaylamadan bekleyen Eser Onaylarınızı veremezsiniz."}{" "}
            <Link href="/writer/agreement" className="underline">
              Sözleşmeye git
            </Link>
          </Alert>
        )}

        <Card>
          <h2 className="mb-4 font-serif text-lg">Bekleyen ({pending.length})</h2>

          {pending.length === 0 ? (
            <EmptyState>Onayınızı bekleyen eser yok.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {pending.map((approval) => (
                <li key={approval.id}>
                  <ApprovalRow
                    approveAction={approveWorkAction}
                    declineAction={declineWorkAction}
                    csrfToken={csrfToken}
                    locked={locked}
                    statement={APPROVAL_STATEMENT}
                    approval={{
                      id: approval.id,
                      articleTitle: approval.articleTitle,
                      articleHash: articleHash(approval.articleBody),
                      agreementVersion: approval.agreementVersion,
                      penName: user.penName,
                      displayName: user.displayName,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Geçmiş</h2>

          {settled.length === 0 ? (
            <EmptyState>Henüz sonuçlanmış onay yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {settled.map((approval) => (
                <li key={approval.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 truncate">{approval.articleTitle}</span>
                  <StatusBadge status={approval.status} />
                  <span className="text-xs text-muted">
                    {formatDate(approval.signedAt ?? approval.declinedAt ?? approval.createdAt)}
                  </span>
                  {approval.formPdfMediaId && (
                    <a
                      href={`/api/media/${approval.formPdfMediaId}`}
                      className="text-xs text-accent underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Onay kaydı (PDF)
                    </a>
                  )}
                  {approval.declinedReason && (
                    <span className="w-full text-xs text-muted">
                      Ret gerekçesi: {approval.declinedReason}
                    </span>
                  )}
                  {approval.signedAt && (
                    <span className="w-full text-xs text-muted">
                      Onay: {formatDateTime(approval.signedAt)} · sözleşme v
                      {approval.agreementVersion ?? "—"} · yayın adı{" "}
                      {approval.bylineChoice === "pen_name" ? "mahlas" : "gerçek ad"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
