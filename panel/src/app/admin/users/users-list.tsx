import { guardPanel } from "@/lib/auth/guard";
import { listUsers } from "@/services/users";
import { UsersTable } from "@/components/users-table";
import { Alert, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import { roleEnum, type Role } from "@/db/schema";
import { USER_SEGMENT_META, type UserSegment } from "@/lib/user-segments";

export type UsersListSearchParams = { q?: string; role?: string; deleted?: string };

/**
 * The body of every admin users list (D-087). The pages differ only in the
 * segment, so the search form, the table and the empty states live here once.
 */
export async function UsersListPage({
  segment,
  searchParams,
}: {
  segment: UserSegment;
  searchParams: Promise<UsersListSearchParams>;
}) {
  const { user } = await guardPanel("admin");
  const filters = await searchParams;
  const meta = USER_SEGMENT_META[segment];

  // Only "Hepsi" mixes roles, so only it offers the role filter
  const role =
    segment === "all" && roleEnum.enumValues.includes(filters.role as Role)
      ? (filters.role as Role)
      : undefined;

  const rows = await listUsers({ ...user }, { segment, query: filters.q, role, limit: 200 });

  return (
    <>
      <PageHeader title={meta.title} description={meta.description} />

      <div className="space-y-6">
        {filters.deleted && (
          <Alert tone="success" title="Kullanıcı silindi">
            Hesap anonimleştirildi ve listeden kaldırıldı.
          </Alert>
        )}

        {segment === "illustrators" ? (
          // There is no illustrator role yet (D-087)
          <Card>
            <EmptyState>Henüz çizer yok.</EmptyState>
          </Card>
        ) : (
          <>
            <Card>
              <form method="get" className="grid gap-3 sm:grid-cols-3">
                <Field label="Ara" htmlFor="q">
                  <Input
                    id="q"
                    name="q"
                    defaultValue={filters.q ?? ""}
                    placeholder="Ad veya e-posta"
                  />
                </Field>

                {segment === "all" && (
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
                )}

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

            <UsersTable rows={rows} segment={segment} />
          </>
        )}
      </div>
    </>
  );
}
