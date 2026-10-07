import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isIssueClosed, pickListIssue } from "@/lib/active-issue";
import { formatWordCount } from "@/lib/word-count";
import { formatDateTime } from "@/lib/utils";
import { listIssues } from "@/services/issues";
import { getActiveIssue } from "@/services/active-issue";
import {
  listIssueAreaGrantsForIssue,
  listLiveAreas,
  listTemporaryAreaCandidates,
  mayManageIssueAreaGrants,
} from "@/services/issue-area-grants";
import { ActionButton, PanelForm } from "@/components/form";
import { IssuePicker } from "@/components/issue-picker";
import { Card, EmptyState, Field, PageHeader, Select, StatusBadge, Table, Td, Th } from "@/components/ui";
import { grantTemporaryAreaAction, revokeTemporaryAreaAction } from "../actions";

export const metadata = { title: "Geçici alan" };

/**
 * One issue's temporary areas (D-306) and the articles written under them,
 * for the main editor and the admins (D-330). A plain category editor gets a
 * 404; the actions and the service check the same rule again.
 */
export default async function TemporaryAreaPage({
  searchParams,
}: {
  searchParams: Promise<{ issueId?: string }>;
}) {
  const { user } = await guardPanel("editor");
  const actor = { ...user };
  if (!(await mayManageIssueAreaGrants(actor))) notFound();

  const { issueId } = await searchParams;
  const [issues, activeIssue, csrfToken] = await Promise.all([
    listIssues(actor),
    getActiveIssue(),
    readCsrfToken(),
  ]);
  const selected = pickListIssue(issues, issueId, activeIssue?.id ?? null);
  const [grants, candidates, areas] = await Promise.all([
    selected ? listIssueAreaGrantsForIssue(actor, selected.id) : Promise.resolve([]),
    listTemporaryAreaCandidates(actor),
    listLiveAreas(actor),
  ]);
  const totalWords = grants.reduce(
    (sum, grant) => sum + grant.articles.reduce((inner, article) => inner + article.wordCount, 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Geçici alan"
        description="Bir yazara, kendi alanı olmayan bir alanı yalnızca bir sayı için verin; o alanda yazdıkları burada görünür."
      />

      <div className="space-y-6">
        {!selected ? (
          <EmptyState>Henüz sayı yok.</EmptyState>
        ) : (
          <>
            <Card>
              <IssuePicker issues={issues} selectedId={selected.id} activeId={activeIssue?.id ?? null} />
            </Card>

            <Card>
              <h2 className="mb-1 font-serif text-lg">Sayı {selected.number}: {grants.length} geçici alan</h2>
              <p className="mb-4 text-xs text-muted">
                Bu alanlarda yazılmış toplam {formatWordCount(totalWords)}.
              </p>
              {grants.length === 0 ? (
                <EmptyState>Bu sayıda verilmiş geçici alan yok.</EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Yazar</Th>
                      <Th>Alan</Th>
                      <Th>Yazılar</Th>
                      <Th>Verildi</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((grant) => (
                      <tr key={grant.id}>
                        <Td>{grant.writerName}</Td>
                        <Td className="text-xs">{grant.areaName}</Td>
                        <Td className="text-xs">
                          {grant.articles.length === 0 ? (
                            <span className="text-muted">Henüz yazı yok</span>
                          ) : (
                            <ul className="space-y-1">
                              {grant.articles.map((article) => (
                                <li key={article.id} className="flex flex-wrap items-center gap-2">
                                  <Link href={`/editor/articles/${article.id}`} className="text-accent hover:underline">
                                    {article.title}
                                  </Link>
                                  <span className="text-muted">{formatWordCount(article.wordCount)}</span>
                                  <StatusBadge status={article.status} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td className="text-xs whitespace-nowrap">{formatDateTime(grant.createdAt)}</Td>
                        <Td>
                          <ActionButton
                            action={revokeTemporaryAreaAction}
                            csrfToken={csrfToken ?? ""}
                            label="Geri al"
                            variant="ghost"
                            fields={{ grantId: grant.id }}
                            confirmMessage="Bu geçici alan geri alınsın mı? O alanda açılmış konu ve yazılar yerinde kalır."
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 font-serif text-lg">Geçici alan ver</h2>
              {isIssueClosed(selected) ? (
                <p className="text-sm text-muted">Yayımlanmış bir sayı için geçici alan verilemez.</p>
              ) : candidates.length === 0 || areas.length === 0 ? (
                <p className="text-sm text-muted">Geçici alan verilebilecek yazar ya da alan yok.</p>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted">
                    Yazar, Sayı {selected.number} için bu alanda konu önerebilir ve yazı yazabilir. Verildiği
                    anda yazara e-posta gider.
                  </p>
                  <PanelForm
                    action={grantTemporaryAreaAction}
                    csrfToken={csrfToken ?? ""}
                    submitLabel="Geçici alanı ver ve e-posta gönder"
                    submitVariant="secondary"
                  >
                    <>
                      <input type="hidden" name="issueId" value={selected.id} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Yazar" htmlFor="temp-writer">
                          <Select id="temp-writer" name="userId" required defaultValue="">
                            <option value="" disabled>
                              Seçin…
                            </option>
                            {candidates.map((writer) => (
                              <option key={writer.id} value={writer.id}>
                                {writer.penName ?? writer.displayName}
                                {[writer.writerArea, writer.writerArea2].filter(Boolean).length > 0
                                  ? ` (${[writer.writerArea, writer.writerArea2].filter(Boolean).join(", ")})`
                                  : ""}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Alan" htmlFor="temp-area">
                          <Select id="temp-area" name="areaId" required defaultValue="">
                            <option value="" disabled>
                              Seçin…
                            </option>
                            {areas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </>
                  </PanelForm>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
