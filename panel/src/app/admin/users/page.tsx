import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { listUsers } from "@/services/users";
import {
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { roleEnum, type Role } from "@/db/schema";

export const metadata = { title: "Kullanıcılar" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const filters = await searchParams;

  const role = roleEnum.enumValues.includes(filters.role as Role)
    ? (filters.role as Role)
    : undefined;

  const rows = await listUsers({ ...user }, { query: filters.q, role, limit: 200 });

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Rol değiştirme, kimlik doğrulama ve hesap işlemleri."
      />

      <div className="space-y-6">
        <Card>
          <form method="get" className="grid gap-3 sm:grid-cols-3">
            <Field label="Ara" htmlFor="q">
              <Input id="q" name="q" defaultValue={filters.q ?? ""} placeholder="Ad veya e-posta" />
            </Field>

            <Field label="Rol" htmlFor="role">
              <Select id="role" name="role" defaultValue={filters.role ?? ""}>
                <option value="">Tümü</option>
                {roleEnum.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end">
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
          <h2 className="mb-4 font-serif text-lg">{rows.length} kullanıcı</h2>

          {rows.length === 0 ? (
            <EmptyState>Bu filtreye uyan kullanıcı yok.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Ad</Th>
                  <Th>E-posta</Th>
                  <Th>Rol</Th>
                  <Th>Durum</Th>
                  <Th>Kayıt</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        href={`/admin/users/${row.id}`}
                        className="text-accent hover:underline"
                      >
                        {row.displayName}
                      </Link>
                      {row.penName && <span className="ml-2 text-xs text-muted">({row.penName})</span>}
                    </Td>
                    <Td className="text-xs">{row.email}</Td>
                    <Td>
                      <StatusBadge status={row.role} />
                    </Td>
                    <Td className="space-x-1 whitespace-nowrap">
                      {row.isBanned && <StatusBadge status="suspended" />}
                      {row.writerStatus && <StatusBadge status={row.writerStatus} />}
                      {!row.emailVerifiedAt && (
                        <span className="text-xs text-warning">e-posta ✗</span>
                      )}
                    </Td>
                    <Td className="text-xs">{formatDate(row.createdAt)}</Td>
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
