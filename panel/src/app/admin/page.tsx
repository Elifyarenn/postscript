import Link from "next/link";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
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

  // Readers who could be promoted today, if the contract settings are in place
  const promotable = await db
    .select({ total: count() })
    .from(users)
    .where(
      and(
        eq(users.role, "user"),
        isNotNull(users.emailVerifiedAt),
        isNotNull(users.birthDate),
        isNotNull(users.kvkkConsentAt),
        eq(users.isBanned, false),
        isNull(users.deletedAt),
      ),
    );

  const counts = Object.fromEntries(byRole.map((row) => [row.role, row.total]));

  return (
    <>
      <PageHeader title="Yönetim" description="Kullanıcılar, sözleşme durumu ve bekleyen işler." />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              // Each count opens its own list (D-087); admins have none, so
              // the general list filtered by role stays their door
              ["user", "Kullanıcı", "/admin/users/readers"],
              ["writer", "Yazar", "/admin/users/writers"],
              ["editor", "Editör", "/admin/users/editors"],
              ["admin", "Yönetici", "/admin/users?role=admin"],
            ] as const
          ).map(([role, label, href]) => (
            <Link
              key={role}
              href={href}
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
          <h2 className="mb-3 font-serif text-lg">Terfiye hazır okuyucular</h2>
          <p className="text-sm text-muted">
            {promotable[0]?.total ?? 0} okuyucu e-posta, doğum tarihi ve KVKK koşullarını
            sağlıyor. Sözleşmenin bu kişiler için render edilebilmesi de gerekir; kullanıcı
            sayfasında ön koşul listesi tek tek gösterilir.
          </p>
        </Card>
      </div>
    </>
  );
}
