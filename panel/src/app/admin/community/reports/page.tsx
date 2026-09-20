import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { REPORT_CATEGORY_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports";
import { cn, formatDateTime } from "@/lib/utils";
import { listReports } from "@/services/reports";
import { PanelForm } from "@/components/form";
import { Card, EmptyState, Field, Input, PersonName, Select, Table, Td, Th } from "@/components/ui";
import { accountLabel } from "../account-label";
import { CommunityAdminHeader } from "../community-admin-header";
import { resolveReportAction } from "../actions";

export const metadata = { title: "İçerik bildirimleri" };

/** Members' reports, oldest open one first, against the 24 hour limit of 5651 s. m. 9 (D-090, D-180). */
export default async function CommunityReportsPage() {
  const { user } = await guardPanel("admin");
  const csrfToken = (await readCsrfToken()) ?? "";
  const [openReports, closedReports] = await Promise.all([
    listReports({ ...user }, "open"),
    listReports({ ...user }, "closed", 50),
  ]);

  return (
    <>
      <CommunityAdminHeader title="İçerik bildirimleri" description="Üyelerin Bildir ile gönderdiği şikâyetler." />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-1 font-serif text-lg">İçerik bildirimleri ({openReports.length} açık)</h2>
          <p className="mb-4 text-sm text-muted">
            Üyelerin &ldquo;Bildir&rdquo; ile gönderdiği şikâyetler, en eskisi üstte. 5651 sayılı Kanun
            gereği en geç 24 saat içinde sonuçlandırılmalı; süresi geçenler işaretlidir. Bir karar,
            aynı içerikle ilgili bütün açık bildirimleri kapatır ve bildirenlere sonucu bildirir.
          </p>

          {openReports.length === 0 ? (
            <EmptyState>Açık bildirim yok.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {openReports.map((report) => (
                <li
                  key={report.id}
                  className={cn(
                    "rounded-md border p-4",
                    report.overdue ? "border-danger/40 bg-danger-soft" : "border-line bg-paper",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{REPORT_TARGET_LABELS[report.targetType]}</span>
                    <span>· {REPORT_CATEGORY_LABELS[report.category]}</span>
                    <span className="text-muted">· {formatDateTime(report.createdAt)}</span>
                    {report.overdue && (
                      <span className="font-semibold text-danger">24 saat geçti</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{report.snapshot}</p>
                  {report.reason && (
                    <p className="mt-2 text-xs text-muted">Açıklama: {report.reason}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    İçerik sahibi:{" "}
                    <PersonName
                      person={{
                        penName: report.ownerPenName,
                        penNameSlug: report.ownerPenNameSlug,
                        username: report.ownerUsername,
                      }}
                      name={accountLabel(report.ownerName, report.ownerUsername)}
                    />{" "}
                    · Bildiren:{" "}
                    <PersonName
                      person={{
                        penName: report.reporterPenName,
                        penNameSlug: report.reporterPenNameSlug,
                        username: report.reporterUsername,
                      }}
                      name={accountLabel(report.reporterName, report.reporterUsername)}
                    />
                  </p>

                  <div className="mt-3 max-w-md">
                    <PanelForm
                      action={resolveReportAction}
                      csrfToken={csrfToken}
                      submitLabel="Sonuçlandır"
                      submitVariant="secondary"
                    >
                      <input type="hidden" name="reportId" value={report.id} />
                      <Field label="Karar" htmlFor={`decision-${report.id}`}>
                        <Select id={`decision-${report.id}`} name="decision" defaultValue="dismiss">
                          {report.targetType !== "member" && (
                            <option value="remove">İçeriği kaldır</option>
                          )}
                          <option value="dismiss">Kurallara aykırı değil</option>
                        </Select>
                      </Field>
                      <Field label="Not (isteğe bağlı)" htmlFor={`note-${report.id}`}>
                        <Input id={`note-${report.id}`} name="note" maxLength={1000} />
                      </Field>
                    </PanelForm>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {closedReports.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Son sonuçlandırılanlar</h3>
              <Table>
                <thead>
                  <tr>
                    <Th>Tür</Th>
                    <Th>İçerik</Th>
                    <Th>Karar</Th>
                    <Th>Tarih</Th>
                  </tr>
                </thead>
                <tbody>
                  {closedReports.map((report) => (
                    <tr key={report.id}>
                      <Td className="text-xs">{REPORT_TARGET_LABELS[report.targetType]}</Td>
                      <Td className="max-w-md">
                        <p className="line-clamp-2 text-xs whitespace-pre-wrap">{report.snapshot}</p>
                      </Td>
                      <Td className="text-xs">
                        {report.status === "removed" ? "Kaldırıldı" : "Aykırı bulunmadı"}
                        {report.resolutionNote && (
                          <span className="block text-muted">{report.resolutionNote}</span>
                        )}
                      </Td>
                      <Td className="text-xs">{formatDateTime(report.resolvedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

      </div>
    </>
  );
}
