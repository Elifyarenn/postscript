import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { acceptanceReport } from "@/services/agreements";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Yönetim" };

export default async function AdminDashboard() {
  const { user } = await guardPanel("admin");

  const [byRole, agreement] = await Promise.all([
    db
      .select({ role: users.role, total: count() })
      .from(users)
      .where(isNull(users.deletedAt))
      .groupBy(users.role),
    acceptanceReport({ ...user }),
  ]);

  const pendingIdentity = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, "user"), isNull(users.identityVerifiedAt), isNull(users.deletedAt)));

  const counts = Object.fromEntries(byRole.map((row) => [row.role, row.total]));

  return (
    <>
      <PageHeader title="Yönetim" description="Kullanıcılar, sözleşme durumu ve bekleyen işler." />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["user", "Kullanıcı"],
              ["writer", "Yazar"],
              ["editor", "Editör"],
              ["admin", "Yönetici"],
            ] as const
          ).map(([role, label]) => (
            <Link
              key={role}
              href={`/admin/users?role=${role}`}
              className="rounded-lg border border-line bg-surface p-4 hover:border-accent"
            >
              <p className="font-serif text-3xl">{counts[role] ?? 0}</p>
              <p className="mt-1 text-sm text-muted">{label}</p>
            </Link>
          ))}
        </div>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Çerçeve sözleşme</h2>

          {agreement.current === null ? (
            <EmptyState>
              Yayınlanmış sözleşme yok.{" "}
              <Link href="/admin/agreements" className="text-accent underline">
                Bir sürüm oluşturun
              </Link>
              .
            </EmptyState>
          ) : (
            <div className="text-sm">
              <p>
                Güncel sürüm: <strong>v{agreement.current.version}</strong>
              </p>
              <p className="mt-2 text-muted">
                {agreement.accepted.length} yazar onayladı, {agreement.pending.length} yazar
                bekliyor.
              </p>

              {agreement.pending.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {agreement.pending.slice(0, 8).map((writer) => (
                    <li key={writer.id}>{writer.displayName}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Kimlik doğrulama bekleyenler</h2>
          <p className="text-sm text-muted">
            {pendingIdentity[0]?.total ?? 0} kullanıcının kimliği doğrulanmamış. Yazar terfisi için
            gereklidir.
          </p>
        </Card>
      </div>
    </>
  );
}
