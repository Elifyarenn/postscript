/**
 * The profile, password and session blocks.
 *
 * Both the plain user area and the writer panel show these, so they live in one
 * place and are handed the data they need.
 */
import { PanelForm, ActionButton } from "./form";
import { Card, EmptyState, Field, Input, Table, Td, Textarea, Th, Alert } from "./ui";
import { formatDateTime } from "@/lib/utils";
import {
  changePasswordAction,
  requestEmailChangeAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateProfileAction,
} from "@/app/account/actions";
import { PasswordField } from "./password-field";
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
                  ["x", "X"],
                  ["instagram", "Instagram"],
                  ["tiktok", "TikTok"],
                  ["substack", "Substack"],
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

export function EmailCard({
  csrfToken,
  email,
  pendingEmail,
}: {
  csrfToken: string;
  email: string;
  pendingEmail: string | null;
}) {
  return (
    <Card>
      <h2 className="mb-4 font-serif text-lg">E-posta adresi</h2>

      {pendingEmail && (
        <div className="mb-4">
          <Alert tone="info">
            <p>
              Yeni adresinize (<strong>{pendingEmail}</strong>) bir doğrulama bağlantısı gönderildi.
              Bağlantıyı açana kadar adresiniz değişmez.
            </p>
          </Alert>
        </div>
      )}

      <p className="mb-4 text-sm text-muted">
        Giriş adresiniz: <strong>{email}</strong>. Değiştirmek için yeni adresinizi yazın;
        doğrulama bağlantısı o adrese gönderilir.
      </p>

      <PanelForm
        action={requestEmailChangeAction}
        csrfToken={csrfToken}
        submitLabel="Değişiklik bağlantısı gönder"
      >
        <Field label="Yeni e-posta adresi" htmlFor="newEmail">
          <Input id="newEmail" name="newEmail" type="email" autoComplete="email" required maxLength={254} />
        </Field>
      </PanelForm>
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
        requireValid
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

            <PasswordField label="Yeni şifre" />

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
