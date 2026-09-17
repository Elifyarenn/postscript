import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { REPORT_CATEGORY_LABELS, REPORT_TARGET_LABELS } from "@/lib/reports";
import { cn, formatDateTime } from "@/lib/utils";
import { unreadMagazineAnonCount } from "@/services/anon-box";
import { listAllBannedWords } from "@/services/community";
import { listCommunitiesForAdmin } from "@/services/communities";
import { countRecentPostActivity } from "@/services/posts";
import { listReports } from "@/services/reports";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Topluluk yönetimi" };

/**
 * The community management panel's front page (D-180). The admins are the
 * community's moderators (D-179); this page says what waits for them and
 * leads to each part, which used to be one long page.
 */
export default async function CommunityAdminPage() {
  const { user } = await guardPanel("admin");
  const actor = { ...user };

  const [openReports, unreadAnon, communityList, activity, banned] = await Promise.all([
    listReports(actor, "open"),
    unreadMagazineAnonCount(actor),
    listCommunitiesForAdmin(actor),
    countRecentPostActivity(actor, 7),
    listAllBannedWords(actor),
  ]);

  const overdue = openReports.filter((report) => report.overdue).length;
  const openCommunities = communityList.filter((community) => !community.archived).length;
  const liveBanned = banned.filter((row) => row.deletedAt === null).length;

  const tiles = [
    {
      href: "/admin/community/reports",
      value: openReports.length,
      label: "Açık içerik bildirimi",
      note: overdue > 0 ? `${overdue} tanesi 24 saati geçti` : "24 saat içinde sonuçlandırılır",
      urgent: overdue > 0,
    },
    {
      href: "/admin/community/anon",
      value: unreadAnon,
      label: "Yeni anonim mesaj",
      note: "Eğlence & Dedikodu için",
      urgent: false,
    },
    {
      href: "/admin/community/communities",
      value: openCommunities,
      label: "Açık topluluk",
      note: `${communityList.length - openCommunities} arşivde`,
      urgent: false,
    },
    {
      href: "/admin/community/posts",
      value: activity.shared,
      label: "Son 7 günde gönderi",
      note: `${activity.removed} tanesi yönetici tarafından kaldırıldı`,
      urgent: false,
    },
    {
      href: "/admin/community/banned-words",
      value: liveBanned,
      label: "Yasaklı kelime",
      note: "Üye içeriğinde yıldızlanır",
      urgent: false,
    },
  ];

  return (
    <>
      <PageHeader
        title="Topluluk yönetimi"
        description="Topluluğun yöneticileri adminlerdir: bildirimleri sonuçlandırır, gönderi kaldırır, toplulukları ve yasaklı kelimeleri yönetirler."
      />

      <div className="space-y-6">
        {overdue > 0 && (
          <Alert tone="danger" title="24 saati geçen içerik bildirimi var">
            {overdue} bildirim 5651 sayılı Kanun&apos;un öngördüğü 24 saatlik cevap süresini
            aştı.{" "}
            <Link href="/admin/community/reports" className="underline">
              Hemen inceleyin
            </Link>
            .
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={cn(
                "rounded-lg border bg-surface p-4 hover:border-accent",
                tile.urgent ? "border-danger/40" : "border-line",
              )}
            >
              <p className="font-serif text-3xl">{tile.value}</p>
              <p className="mt-1 text-sm">{tile.label}</p>
              <p className={cn("mt-1 text-xs", tile.urgent ? "text-danger" : "text-muted")}>{tile.note}</p>
            </Link>
          ))}
        </div>

        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-lg">Sırada bekleyen bildirimler</h2>
            <Link href="/admin/community/reports" className="text-sm text-accent hover:underline">
              Tümü →
            </Link>
          </div>

          {openReports.length === 0 ? (
            <EmptyState>Açık bildirim yok.</EmptyState>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {openReports.slice(0, 5).map((report) => (
                <li key={report.id} className="py-2.5">
                  <p className="text-xs">
                    <span className="font-semibold">{REPORT_TARGET_LABELS[report.targetType]}</span> ·{" "}
                    {REPORT_CATEGORY_LABELS[report.category]} ·{" "}
                    <span className="text-muted">{formatDateTime(report.createdAt)}</span>
                    {report.overdue && <span className="ml-1 font-semibold text-danger">24 saat geçti</span>}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap">{report.snapshot}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-serif text-lg">Diğer bölümler</h2>
          <ul className="divide-y divide-line text-sm">
            <li>
              <Link href="/admin/community/comments" className="block py-2.5 hover:text-accent">
                Yorumlar ve sohbet: yazı yorumları ve eski topluluk sohbetinin mesajları
              </Link>
            </li>
          </ul>
          {/* No link out to the community: the panel leads nowhere on the site (D-165) */}
          <p className="mt-3 text-xs text-muted">
            Toplulukta bir gönderinin altındaki &ldquo;Kaldır&rdquo; ile de gönderi kaldırabilirsiniz.
          </p>
        </Card>
      </div>
    </>
  );
}
