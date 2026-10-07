import Link from "next/link";
import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { listPendingApprovals, LICENCE_TERMS } from "@/services/rights";
import { listIssues } from "@/services/issues";
import { getActiveIssue } from "@/services/active-issue";
import { pickListIssue } from "@/lib/active-issue";
import { IssuePicker } from "@/components/issue-picker";
import { getCurrentAgreement } from "@/services/agreements";
import { readCsrfToken } from "@/lib/csrf";
import { PanelForm } from "@/components/form";
import { Alert, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { sendRemindersAction } from "../actions";

export const metadata = { title: "Eser Onayı takibi" };

export default async function EditorApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ issueId?: string }>;
}) {
  const { user } = await guardAdminWithinEditor();
  const csrfToken = (await readCsrfToken()) ?? "";

  // One issue's approvals, the active issue's unless another is chosen (D-330)
  const [issues, activeIssue] = await Promise.all([listIssues({ ...user }), getActiveIssue()]);
  const selected = pickListIssue(issues, (await searchParams).issueId, activeIssue?.id ?? null);
  const pending = selected ? await listPendingApprovals({ ...user }, selected.id) : [];
  const agreement = await getCurrentAgreement();

  return (
    <>
      <PageHeader
        title="Eser Onayı takibi"
        description="Yazarın onayı olmadan hiçbir eser yayımlanamaz (Sözleşme m. 5.4)."
      />

      <div className="space-y-6">
        {selected && (
          <Card>
            <IssuePicker issues={issues} selectedId={selected.id} activeId={activeIssue?.id ?? null} />
          </Card>
        )}

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg">Bekleyen onaylar ({pending.length})</h2>

            <PanelForm
              action={sendRemindersAction}
              csrfToken={csrfToken}
              submitLabel="Hatırlatma gönder"
              submitVariant="secondary"
            />
          </div>

          <Alert tone="info">
            Hatırlatma, üç günden uzun süredir bekleyen ve son üç gün içinde hatırlatılmamış
            onaylara gönderilir.
          </Alert>

          <div className="mt-4">
            {pending.length === 0 ? (
              <EmptyState>Bekleyen onay yok.</EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Eser</Th>
                    <Th>Yazar</Th>
                    <Th>Açılış</Th>
                    <Th>Son hatırlatma</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((approval) => (
                    <tr key={approval.id}>
                      <Td>{approval.articleTitle}</Td>
                      <Td className="text-xs">{approval.writerName}</Td>
                      <Td className="text-xs">
                        {formatDate(approval.createdAt)}
                        {approval.isOverdue && (
                          <span className="ml-2 text-warning">gecikmiş</span>
                        )}
                      </Td>
                      <Td className="text-xs">
                        {approval.reminderSentAt ? formatDate(approval.reminderSentAt) : "—"}
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/editor/articles/${approval.articleId}`}
                          className="text-xs text-accent underline"
                        >
                          Makale
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-serif text-lg">Ruhsat kapsamı</h2>
          <p className="mb-4 text-sm text-muted">
            Kapsam sözleşmenin 4. maddesinde sabittir; eser başına değiştirilemez.
            {agreement && ` Geçerli sürüm: v${agreement.version}.`}
          </p>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Ruhsat türü</dt>
              <dd>Basit ruhsat (FSEK m. 56/1) — mali hak devri yok</dd>
            </div>
            <div>
              <dt className="text-muted">Süre ve yer</dt>
              <dd>Süresiz · {LICENCE_TERMS.territory}</dd>
            </div>
            <div>
              <dt className="text-muted">Mecralar</dt>
              <dd>{LICENCE_TERMS.channels.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-muted">Bedel / ticari kullanım</dt>
              <dd>Yok / hariç</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">İşleme hakkı</dt>
              <dd>
                Yalnızca dil ve biçim düzeltmesi, 300 kelimeyi aşmayan tanıtım alıntısı ve sayfa
                düzeni (m. 4.2). Çeviri, kısaltma ve tür dönüşümü kapsam dışıdır.
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
