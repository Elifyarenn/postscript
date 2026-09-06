import { guardPanel } from "@/lib/auth/guard";
import { queryAuditLog } from "@/services/audit-query";
import {
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Denetim kaydı" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; from?: string; to?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const filters = await searchParams;

  const rows = await queryAuditLog({ ...user }, filters);

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

  return (
    <>
      <PageHeader
        title="Denetim kaydı"
        description="Eklenebilir, değiştirilemez. Veritabanı seviyesinde de korunur."
        actions={
          <a
            href={`/api/admin/audit.csv${query ? `?${query}` : ""}`}
            className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm hover:bg-paper"
          >
            CSV indir
          </a>
        }
      />

      <div className="space-y-6">
        <Card>
          <form method="get" className="grid gap-3 sm:grid-cols-4">
            <Field label="Eylem" htmlFor="action">
              <Input
                id="action"
                name="action"
                defaultValue={filters.action ?? ""}
                placeholder="article.status"
              />
            </Field>

            <Field label="Varlık" htmlFor="entityType">
              <Input
                id="entityType"
                name="entityType"
                defaultValue={filters.entityType ?? ""}
                placeholder="articles"
              />
            </Field>

            <Field label="Başlangıç" htmlFor="from">
              <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
            </Field>

            <Field label="Bitiş" htmlFor="to">
              <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
            </Field>

            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm hover:bg-paper"
              >
                Uygula
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-serif text-lg">Son {rows.length} kayıt</h2>

          {rows.length === 0 ? (
            <EmptyState>Bu filtreye uyan kayıt yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Zaman</Th>
                  <Th>Eylem</Th>
                  <Th>Varlık</Th>
                  <Th>Yapan</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</Td>
                    <Td className="font-mono text-xs">{row.action}</Td>
                    <Td className="text-xs">
                      {row.entityType}
                      {row.entityId && (
                        <span className="ml-1 text-muted">{row.entityId.slice(0, 8)}…</span>
                      )}
                    </Td>
                    <Td className="text-xs">{row.actorName ?? "sistem"}</Td>
                    <Td className="text-xs">{row.ip ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
