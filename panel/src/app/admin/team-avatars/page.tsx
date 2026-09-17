import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { avatarDataUri } from "@/lib/avatar/render";
import { listTeamAvatars } from "@/services/team-avatars";

export const metadata = { title: "Ekip avatarları" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

/**
 * Every team avatar sent from the builder (D-194). The previews are drawn from
 * the saved configuration on the page itself; the PNG and ZIP buttons fetch
 * the stored files. The selection form is a plain GET, so it needs no script.
 */
export default async function TeamAvatarsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const [avatars, params] = await Promise.all([listTeamAvatars({ ...user }), searchParams]);

  return (
    <>
      <PageHeader
        title="Ekip avatarları"
        description="Ekip üyelerinin avatar oluşturucudan gönderdiği avatarlar. PNG dosyaları transparan arka planlı ve 2048×2048 pikseldir."
        actions={
          avatars.length > 0 ? (
            <a
              href="/api/admin/team-avatars/zip"
              className="inline-flex items-center rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Tümünü ZIP indir ({avatars.length})
            </a>
          ) : undefined
        }
      />

      {params.deleted && (
        <div className="mb-4">
          <Alert tone="success">Avatar silindi.</Alert>
        </div>
      )}

      <Card className="mb-6">
        <p className="text-sm text-muted">
          Ekip üyeleri avatarlarını{" "}
          <Link href="/team/avatar" className="text-accent underline">
            /team/avatar
          </Link>{" "}
          adresinden oluşturur. Sayfa yazarlara, editörlere, yöneticilere ve çizer olarak işaretli
          üyelere açıktır; bağlantıyı ekiple paylaşabilirsiniz.
        </p>
      </Card>

      {avatars.length === 0 ? (
        <EmptyState>Henüz gönderilmiş bir ekip avatarı yok.</EmptyState>
      ) : (
        <form method="get" action="/api/admin/team-avatars/zip">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">Toplu indirmek için kartlardaki kutuları işaretleyin.</p>
            <button
              type="submit"
              className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              Seçilenleri ZIP indir
            </button>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {avatars.map((avatar) => (
              <li key={avatar.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" name="id" value={avatar.id} className="h-4 w-4" />
                      Seç
                    </label>
                    <span className="text-xs text-muted">{dateFormat.format(avatar.createdAt)}</span>
                  </div>

                  <Link
                    href={`/admin/team-avatars/${avatar.id}`}
                    className="block overflow-hidden rounded-md border border-line bg-paper"
                    title="Büyük önizleme"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- an SVG drawn from the saved configuration */}
                    <img
                      src={avatarDataUri(avatar.config, { size: 320 })}
                      alt={`${avatar.displayName} avatarı`}
                      width={320}
                      height={320}
                      className="aspect-square h-auto w-full"
                    />
                  </Link>

                  <div>
                    <p className="font-serif text-lg text-ink">{avatar.displayName}</p>
                    <p className="text-sm text-muted">{avatar.teamRole}</p>
                    <p className="mt-1 text-xs text-muted">
                      Hesap:{" "}
                      <Link href={`/admin/users/${avatar.user.id}`} className="underline">
                        {avatar.user.penName ?? avatar.user.displayName}
                      </Link>{" "}
                      · {avatar.user.email}
                    </p>
                    {avatar.updatedAt.getTime() !== avatar.createdAt.getTime() && (
                      <p className="text-xs text-muted">Güncellendi: {dateFormat.format(avatar.updatedAt)}</p>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <a
                      href={`/api/admin/team-avatars/${avatar.id}/png`}
                      className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                    >
                      PNG İndir
                    </a>
                    <Link
                      href={`/admin/team-avatars/${avatar.id}`}
                      className="rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-paper"
                    >
                      Avatarı Görüntüle
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </form>
      )}
    </>
  );
}
