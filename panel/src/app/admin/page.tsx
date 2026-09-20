import Link from "next/link";
import { and, asc, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { acceptanceReport } from "@/services/agreements";
import { pendingAdminWork } from "@/services/admin-overview";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Yönetim" };

export default async function AdminDashboard() {
  const { user } = await guardPanel("admin");

  const [byRole, agreement, pending] = await Promise.all([
    db
      .select({ role: users.role, total: count() })
      .from(users)
      .where(isNull(users.deletedAt))
      .groupBy(users.role),
    acceptanceReport({ ...user }),
    pendingAdminWork({ ...user }),
  ]);

  const queues = [
    { label: "Açık içerik bildirimi", total: pending.openReports, href: "/admin/community/reports" },
    {
      label: "Yönetim onayı bekleyen yazar başvurusu",
      total: pending.applicationsAwaitingAdmin,
      href: "/admin/applications",
    },
    {
      label: "Yayın kuyruğunda onay bekleyen yazı",
      total: pending.articlesAwaitingAdmin,
      href: "/editor/articles?status=ready_for_publishing",
    },
  ];
  const nothingPending = queues.every((queue) => queue.total === 0);

  // A writer with no pen name is published without a name and has no author
  // page; the byline rule is in `publicByline` (D-210)
  const withoutPenName = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(
      and(
        inArray(users.role, ["writer", "editor", "admin"]),
        isNull(users.penName),
        isNull(users.deletedAt),
        eq(users.isBanned, false),
      ),
    )
    .orderBy(asc(users.displayName));

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
        {/* First on the page: admins mostly check in from a phone (D-097) */}
        <Card>
          <h2 className="mb-3 font-serif text-lg">Bekleyen işler</h2>

          {pending.overdueReports > 0 && (
            <div className="mb-4">
              <Alert tone="danger" title="24 saati geçen içerik bildirimi var">
                {pending.overdueReports} bildirim 5651 sayılı Kanun&apos;un öngördüğü 24
                saatlik cevap süresini aştı.{" "}
                <Link href="/admin/community/reports" className="underline">
                  Hemen inceleyin
                </Link>
                .
              </Alert>
            </div>
          )}

          {nothingPending ? (
            <EmptyState>Şu anda sizi bekleyen bir iş yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {queues.map((queue) => (
                <li key={queue.href}>
                  <Link
                    href={queue.href}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-accent"
                  >
                    <span>{queue.label}</span>
                    <span
                      className={
                        queue.total > 0
                          ? "rounded-full bg-accent px-2 text-xs leading-6 font-semibold text-paper"
                          : "text-xs text-muted"
                      }
                    >
                      {queue.total}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

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
          <h2 className="mb-3 font-serif text-lg">Mahlası olmayanlar</h2>
          {withoutPenName.length === 0 ? (
            <p className="text-sm text-muted">Herkesin mahlası var.</p>
          ) : (
            <div className="text-sm">
              <p>
                <strong>{withoutPenName.length}</strong> kişinin mahlası yok. Yazıları
                isimsiz yayımlanır (devir formunda gerçek adı seçmedikleri sürece) ve
                okurun gidebileceği bir yazar sayfaları olmaz.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {withoutPenName.slice(0, 8).map((person) => (
                  <li key={person.id}>
                    <Link href={`/admin/users/${person.id}`} className="hover:underline">
                      {person.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
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
