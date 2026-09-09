import { guardPanel } from "@/lib/auth/guard";
import { listUsers } from "@/services/users";
import { UsersTable } from "@/components/users-table";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { roleEnum, type Role } from "@/db/schema";

export const metadata = { title: "Kullanıcılar" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; deleted?: string }>;
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
        {filters.deleted && (
          <Alert tone="success" title="Kullanıcı silindi">
            Hesap anonimleştirildi ve listeden kaldırıldı.
          </Alert>
        )}

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

        <UsersTable rows={rows} />
      </div>
    </>
  );
}
