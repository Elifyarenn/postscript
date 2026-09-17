import Link from "next/link";
import { guardPanel } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { ActionButton } from "@/components/form";
import { Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { AVATAR_CATEGORIES, extraLabels, optionLabel } from "@/lib/avatar/options";
import { getTeamAvatar } from "@/services/team-avatars";
import { deleteTeamAvatarAction } from "../actions";

export const metadata = { title: "Ekip avatarı" };

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

/** One team avatar. The large preview is the stored PNG itself, on a checkerboard that shows its transparency. */
export default async function TeamAvatarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardPanel("admin");
  const { id } = await params;
  const [avatar, csrfToken] = await Promise.all([getTeamAvatar({ ...user }, id), readCsrfToken()]);

  return (
    <>
      <PageHeader
        title={avatar.displayName}
        description={avatar.teamRole}
        actions={
          <Link
            href="/admin/team-avatars"
            className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            ← Tüm avatarlar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <div
            className="overflow-hidden rounded-md border border-line"
            style={{
              backgroundColor: "#ffffff",
              backgroundImage: "conic-gradient(#eeeeee 25%, transparent 0 50%, #eeeeee 0 75%, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the stored PNG, served by an admin-only route */}
            <img
              src={`/api/admin/team-avatars/${avatar.id}/png?inline=1`}
              alt={`${avatar.displayName} avatarı`}
              width={2048}
              height={2048}
              className="aspect-square h-auto w-full"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={`/api/admin/team-avatars/${avatar.id}/png`}
              className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              PNG İndir
            </a>
            <span className="text-xs text-muted">{avatar.fileName} · 2048×2048 · transparan</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-serif text-lg">Kayıt</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">İsim</dt>
              <dd>{avatar.displayName}</dd>
              <dt className="text-muted">Rol</dt>
              <dd>{avatar.teamRole}</dd>
              <dt className="text-muted">Hesap</dt>
              <dd>
                <Link href={`/admin/users/${avatar.user.id}`} className="text-accent underline">
                  {avatar.user.penName ?? avatar.user.displayName}
                </Link>{" "}
                <span className="text-muted">({avatar.user.email})</span>
              </dd>
              <dt className="text-muted">Oluşturulma</dt>
              <dd>{dateFormat.format(avatar.createdAt)}</dd>
              <dt className="text-muted">Son güncelleme</dt>
              <dd>{dateFormat.format(avatar.updatedAt)}</dd>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 font-serif text-lg">Avatar konfigürasyonu</h2>
            <Table>
              <thead>
                <tr>
                  <Th>Kategori</Th>
                  <Th>Seçim</Th>
                </tr>
              </thead>
              <tbody>
                {AVATAR_CATEGORIES.map((category) => (
                  <tr key={category.key}>
                    <Td>{category.label}</Td>
                    <Td>{optionLabel(category.key, avatar.config[category.key])}</Td>
                  </tr>
                ))}
                <tr>
                  <Td>Küçük detaylar</Td>
                  <Td>{extraLabels(avatar.config.extras).join(", ") || "Yok"}</Td>
                </tr>
              </tbody>
            </Table>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted">Ham JSON</summary>
              <pre className="mt-2 overflow-x-auto rounded bg-paper p-3">{JSON.stringify(avatar.config, null, 2)}</pre>
            </details>
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-lg">Sil</h2>
            <p className="mb-3 text-sm text-muted">
              Kayıt ve PNG dosyası kalıcı olarak silinir; üye isterse yeniden oluşturabilir.
            </p>
            <ActionButton
              action={deleteTeamAvatarAction}
              csrfToken={csrfToken ?? ""}
              label="Avatarı sil"
              variant="danger"
              fields={{ avatarId: avatar.id }}
              confirmMessage={`${avatar.displayName} adlı üyenin avatarı silinsin mi?`}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
