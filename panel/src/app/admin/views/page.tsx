import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { issueViewReport } from "@/services/issue-views";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Sayı görüntülenmeleri" };

const number = (value: number) => value.toLocaleString("tr-TR");

export default async function AdminIssueViewsPage() {
  const { user } = await guardPanel("admin");
  const report = await issueViewReport({ ...user });

  return (
    <>
      <PageHeader
        title="Sayı görüntülenmeleri"
        description="Okuyucuda bir sayının kaç kez açıldığı (D-344). Aynı tarayıcı aynı sayıyı bir günde bir kez sayılır; editör ve admin açılışları sayılmaz. Sayım 21 Ekim 2026'da başladı, öncesi yok."
      />

      {report.length === 0 ? (
        <EmptyState>Henüz yayımlanmış ya da sayılmış bir sayı yok.</EmptyState>
      ) : (
        <>
          <Card className="mb-6">
            <Table>
              <thead>
                <tr>
                  <Th>Sayı</Th>
                  <Th>Durum</Th>
                  <Th className="text-right">Son 7 gün</Th>
                  <Th className="text-right">Son 30 gün</Th>
                  <Th className="text-right">Toplam</Th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.issueId}>
                    <Td>
                      <a href={`#sayi-${row.number}`} className="text-accent underline">
                        Sayı {String(row.number).padStart(2, "0")}
                      </a>{" "}
                      <span className="text-muted">· {row.title}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{number(row.last7Days)}</Td>
                    <Td className="text-right tabular-nums">{number(row.last30Days)}</Td>
                    <Td className="text-right font-medium tabular-nums">{number(row.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          {report.map((row) => (
            <Card key={row.issueId} id={`sayi-${row.number}`} className="mb-6">
              <h2 className="mb-1 font-serif text-lg">
                Sayı {String(row.number).padStart(2, "0")} · gün gün
              </h2>
              <p className="mb-3 text-sm text-muted">
                Toplam {number(row.total)} görüntülenme.{" "}
                {row.status === "published" && (
                  <Link href={`/magazine/issues/${row.number}`} className="text-accent underline">
                    Sayının sayfası
                  </Link>
                )}
              </p>
              {row.days.length === 0 ? (
                <EmptyState>Bu sayı henüz hiç açılmadı.</EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Gün</Th>
                      <Th className="text-right">Görüntülenme</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.days.map((day) => (
                      <tr key={day.day}>
                        <Td>{formatDate(day.day)}</Td>
                        <Td className="text-right tabular-nums">{number(day.views)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          ))}
        </>
      )}
    </>
  );
}
