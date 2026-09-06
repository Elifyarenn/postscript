import Link from "next/link";
import { guardWriterInnerPages } from "@/lib/auth/guard";
import { listGrantsForWriter } from "@/services/rights";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Devir formları" };

const TABS = [
  { key: "pending", label: "Bekleyen" },
  { key: "signed", label: "İmzalanan" },
  { key: "declined", label: "Reddedilen" },
] as const;

export default async function WriterRightsPage() {
  const { user } = await guardWriterInnerPages();
  const grants = await listGrantsForWriter({ ...user });

  return (
    <>
      <PageHeader
        title="Hak devri formları"
        description="Eser bazlı mali hak devri formlarınız. İmzalanmadan yazı yayına alınamaz."
      />

      <div className="space-y-6">
        {TABS.map((tab) => {
          const rows = grants.filter((grant) => grant.status === tab.key);

          return (
            <Card key={tab.key}>
              <h2 className="mb-4 font-serif text-lg">{tab.label}</h2>

              {rows.length === 0 ? (
                <EmptyState>Bu bölümde form yok.</EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Eser</Th>
                      <Th>Durum</Th>
                      <Th>Tarih</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((grant) => (
                      <tr key={grant.id}>
                        <Td>{grant.articleTitle}</Td>
                        <Td>
                          <StatusBadge status={grant.status} />
                        </Td>
                        <Td className="text-xs">
                          {formatDate(grant.signedAt ?? grant.declinedAt ?? grant.createdAt)}
                        </Td>
                        <Td className="text-right whitespace-nowrap">
                          <Link
                            href={`/writer/rights/${grant.id}`}
                            className="text-sm text-accent underline"
                          >
                            {grant.status === "pending" ? "Formu aç" : "Görüntüle"}
                          </Link>
                          {grant.formPdfMediaId && (
                            <a
                              href={`/api/media/${grant.formPdfMediaId}`}
                              className="ml-3 text-sm text-muted underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF
                            </a>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
