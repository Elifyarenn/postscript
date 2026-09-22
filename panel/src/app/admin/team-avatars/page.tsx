import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { TEAM_BYLINE_LABELS, teamBylineName, zodiacLabel } from "@/lib/zodiac";
import { avatarDataUri } from "@/lib/avatar/render";
import { listTeamAvatars, listTeamMembersMissing, type MissingTeamMember } from "@/services/team-avatars";
import { chaseMessage, whatsappHref } from "@/lib/whatsapp";

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
/** One side of the Eksikler card: a heading, a count and the names (D-230). */
function MissingList({
  title,
  people,
  empty,
  missing,
}: {
  title: string;
  people: MissingTeamMember[];
  empty: string;
  missing: "avatar" | "form";
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">
        {title} ({people.length})
      </h3>
      {people.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {people.map((person) => {
            // Opens WhatsApp with the message ready; the admin presses send (D-231)
            const href = whatsappHref(person.phone, chaseMessage(missing));
            return (
              <li key={person.id}>
                <Link href={`/admin/users/${person.id}`} className="underline">
                  {person.displayName}
                </Link>
                <span className="text-muted"> · {dutyLabel(person)}</span>
                {href !== null && (
                  <>
                    {" · "}
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                      title="WhatsApp'ta hazır mesajla aç"
                    >
                      WhatsApp
                    </a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** What the person does, from the role and the illustrator mark (D-227). */
function dutyLabel(person: MissingTeamMember): string {
  const duties = person.role === "writer" ? ["yazar"] : person.role === "editor" ? ["editör"] : [];
  if (person.isIllustrator) duties.push("çizer");
  return duties.length > 0 ? duties.join(", ") : "ekip";
}

export default async function TeamAvatarsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { user } = await guardPanel("admin");
  const [avatars, missing, params] = await Promise.all([
    listTeamAvatars({ ...user }),
    // Who still owes something (D-230)
    listTeamMembersMissing({ ...user }),
    searchParams,
  ]);
  const withoutAvatar = missing.filter((person) => !person.hasAvatar);
  const withoutForm = missing.filter((person) => person.hasAvatar);

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

      {/* Who is still owed (D-230); the product owner chases the admins herself */}
      {missing.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-1 font-serif text-lg">Eksikler ({missing.length})</h2>
          <p className="mb-4 text-xs text-muted">Yöneticiler bu listede yok.</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <MissingList
              title="Avatarını oluşturmayanlar"
              people={withoutAvatar}
              empty="Herkes avatarını gönderdi."
              missing="avatar"
            />
            <MissingList
              title="Formu doldurmayanlar"
              people={withoutForm}
              empty="Avatarı olan herkes formu doldurdu."
              missing="form"
            />
          </div>
        </Card>
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
                    {/* A writer's areas, where the magazine records what they cover (D-228) */}
                    {avatar.user.areas.length > 0 && (
                      <p className="text-xs text-muted">Alanları: {avatar.user.areas.join(", ")}</p>
                    )}
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

                  {/* The team form's answers, beside the drawing and the duty (D-226) */}
                  {avatar.form.answered ? (
                    <dl className="space-y-1 rounded-md border border-line bg-paper p-3 text-xs">
                      <div>
                        <dt className="text-muted">Sözü</dt>
                        <dd className="text-ink">&ldquo;{avatar.form.motto}&rdquo;</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Ekip sayfasında</dt>
                        <dd className="text-ink">
                          {TEAM_BYLINE_LABELS[avatar.form.teamByline ?? ""] ?? "—"}
                          {/* The name that choice lands on, not only the preference (D-229) */}
                          {teamBylineName(avatar.form.teamByline, avatar.user) !== null ? (
                            <span className="text-muted">
                              {" "}
                              ({teamBylineName(avatar.form.teamByline, avatar.user)})
                            </span>
                          ) : (
                            avatar.form.teamByline === "pen_name" && (
                              <span className="text-danger"> (mahlası yok)</span>
                            )
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Burcu</dt>
                        <dd className="text-ink">{zodiacLabel(avatar.form.zodiac) ?? "—"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="rounded-md border border-dashed border-line p-3 text-xs text-muted">
                      Ekip formunu henüz doldurmadı.
                    </p>
                  )}

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
