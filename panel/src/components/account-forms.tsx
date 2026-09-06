/**
 * The profile, password and session blocks.
 *
 * Both the plain user area and the writer panel show these, so they live in one
 * place and are handed the data they need.
 */
import Link from "next/link";
import { PanelForm, ActionButton } from "./form";
import { Alert, Card, EmptyState, Field, Input, Table, Td, Textarea, Th } from "./ui";
import { formatDateTime } from "@/lib/utils";
import {
  changePasswordAction,
  disableTotpAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateProfileAction,
} from "@/app/account/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import type { SessionUser } from "@/lib/auth/session";
import type { SocialLinks } from "@/db/schema";

export function ProfileCard({
  csrfToken,
  user,
  bio,
  socialLinks,
}: {
  csrfToken: string;
  user: SessionUser;
  bio: string | null;
  socialLinks: SocialLinks | null;
}) {
  return (
    <Card>
      <h2 className="mb-4 font-serif text-lg">Profil</h2>

      <PanelForm action={updateProfileAction} csrfToken={csrfToken} submitLabel="Profili kaydet">
          <>
            <Field
              label="Ad Soyad"
              htmlFor="displayName"
            >
              <Input
                id="displayName"
                name="displayName"
                defaultValue={user.displayName}
                required
                maxLength={80}
              />
            </Field>

            <Field
              label="Mahlas"
              htmlFor="penName"
              hint="Yayında bu ad görünür. Boş bırakırsanız ad soyadınız kullanılır."
            >
              <Input
                id="penName"
                name="penName"
                defaultValue={user.penName ?? ""}
                maxLength={80}
              />
            </Field>

            <Field label="Kısa biyografi" htmlFor="bio">
              <Textarea id="bio" name="bio" defaultValue={bio ?? ""} maxLength={2000} />
            </Field>

            <Field
              label="Doğum tarihi"
              htmlFor="birthDate"
              hint={
                user.birthDate
                  ? "Kaydedildikten sonra yalnızca yönetici değiştirebilir."
                  : "Yazar olabilmek için gereklidir ve bir kez kaydedilir."
              }
            >
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={user.birthDate ?? ""}
                readOnly={Boolean(user.birthDate)}
                disabled={Boolean(user.birthDate)}
              />
            </Field>

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-1.5 text-sm font-medium">Bağlantılar</legend>
              {(
                [
                  ["website", "İnternet sitesi"],
                  ["x", "X"],
                  ["instagram", "Instagram"],
                  ["linkedin", "LinkedIn"],
                  ["mastodon", "Mastodon"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`social_${key}`}>
                  <Input
                    id={`social_${key}`}
                    name={`social_${key}`}
                    type="url"
                    placeholder="https://"
                    defaultValue={socialLinks?.[key] ?? ""}
                  />
                </Field>
              ))}
            </fieldset>
          </>
      </PanelForm>
    </Card>
  );
}

/**
 * The second factor, offered to every account that is not already forced to
 * have one. Editors and admins never see it: the specification makes the factor
 * mandatory for them, so there is nothing here for them to decide.
 */
export function TwoFactorCard({
  csrfToken,
  confirmedAt,
  mandatory,
}: {
  csrfToken: string;
  confirmedAt: Date | null;
  mandatory: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-3 font-serif text-lg">İki adımlı doğrulama</h2>

      {confirmedAt ? (
        <>
          <Alert tone="success">{formatDateTime(confirmedAt)} tarihinde açıldı.</Alert>

          {mandatory ? (
            <p className="mt-4 text-sm text-muted">
              Rolünüz için zorunludur, kapatılamaz.
            </p>
          ) : (
            <div className="mt-4">
              <ActionButton
                action={disableTotpAction}
                csrfToken={csrfToken}
                label="Kapat"
                variant="danger"
                confirmMessage="İki adımlı doğrulama kapatılacak. Devam edilsin mi?"
              />
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            İsteğe bağlıdır, ama hesabınızı belirgin biçimde güvenli hale getirir. Şifreniz başka
            birinin eline geçse bile telefonunuzdaki kod olmadan giriş yapılamaz.
          </p>
          <Link
            href="/two-factor/setup"
            className="inline-block rounded-md border border-line bg-surface px-3.5 py-2 text-sm hover:bg-paper"
          >
            Kurulumu başlat
          </Link>
        </>
      )}
    </Card>
  );
}

export function PasswordCard({ csrfToken }: { csrfToken: string }) {
  return (
    <Card>
      <h2 className="mb-4 font-serif text-lg">Şifre</h2>

      <PanelForm
        action={changePasswordAction}
        csrfToken={csrfToken}
        submitLabel="Şifreyi güncelle"
      >
          <>
            <Field
              label="Mevcut şifre"
              htmlFor="currentPassword"
            >
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <Field
              label="Yeni şifre"
              htmlFor="password"
              hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </Field>

            <Field
              label="Yeni şifre (tekrar)"
              htmlFor="passwordConfirm"
            >
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </>
      </PanelForm>
    </Card>
  );
}

export type SessionRow = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: Date;
  createdAt: Date;
};

export function SessionsCard({
  csrfToken,
  sessions,
  currentSessionId,
}: {
  csrfToken: string;
  sessions: SessionRow[];
  currentSessionId: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg">Aktif oturumlar</h2>
        <ActionButton
          action={revokeOtherSessionsAction}
          csrfToken={csrfToken}
          label="Diğerlerini kapat"
          confirmMessage="Bu cihaz dışındaki tüm oturumlar kapatılacak. Devam edilsin mi?"
        />
      </div>

      {sessions.length === 0 ? (
        <EmptyState>Kayıtlı oturum yok.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Cihaz</Th>
              <Th>IP</Th>
              <Th>Son görülme</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <Td className="max-w-xs truncate text-xs" title={session.userAgent ?? ""}>
                  {session.userAgent ?? "Bilinmiyor"}
                  {session.id === currentSessionId && (
                    <span className="ml-2 text-accent">(bu cihaz)</span>
                  )}
                </Td>
                <Td className="text-xs">{session.ip ?? "—"}</Td>
                <Td className="text-xs">{formatDateTime(session.lastSeenAt)}</Td>
                <Td className="text-right">
                  {session.id !== currentSessionId && (
                    <ActionButton
                      action={revokeSessionAction}
                      csrfToken={csrfToken}
                      label="Kapat"
                      fields={{ sessionId: session.id }}
                    />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
