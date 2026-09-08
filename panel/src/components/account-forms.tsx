/**
 * The profile, password and session blocks.
 *
 * Both the plain user area and the writer panel show these, so they live in one
 * place and are handed the data they need.
 */
import Link from "next/link";
import Image from "next/image";
import { PanelForm, ActionButton } from "./form";
import {
  Card,
  EmptyState,
  Field,
  Input,
  Table,
  Td,
  Textarea,
  Th,
  Alert,
  StatusBadge,
} from "./ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  changePasswordAction,
  disableTwoFactorAction,
  enableTwoFactorAction,
  requestEmailChangeAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  selfFreezeDutyAction,
  submitWriterApplicationAction,
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

export type ApplicationCardData = {
  id: string;
  status: string;
  note: string | null;
  reviewNote: string | null;
  submittedAt: Date;
  sampleMediaId: string | null;
};

/**
 * The writer application block on the account page.
 *
 * The submit button only appears when every prerequisite holds; otherwise the
 * missing ones are listed next to the disabled button, so the user sees the
 * reason without having to click anything. The server re-checks all of it in
 * the action — this card is a courtesy, not the gate.
 */
export function WriterApplicationCard({
  csrfToken,
  role,
  problems,
  messages,
  latest,
  cooldown,
}: {
  csrfToken: string;
  role: SessionUser["role"];
  /** Machine ids of the unmet prerequisites, if any (see `checkWriterEligibility`). */
  problems: string[];
  /** Human readable versions of the same list, for the warning box. */
  messages: string[];
  latest: ApplicationCardData | null;
  cooldown: { withinCooldown: boolean; retryAt: Date | null };
}) {
  if (role !== "user" && !latest) return null;

  const open = latest && !["signed", "editor_rejected", "admin_rejected"].includes(latest.status);
  const ready = problems.length === 0;

  const RULES: [string, string][] = [
    ["email_not_verified", "E-posta adresi doğrulanmış"],
    ["birth_date_missing", "Doğum tarihi girilmiş"],
    ["under_age", "18 yaşını doldurmuş"],
    ["kvkk_consent_missing", "Güncel KVKK onayı verilmiş"],
    ["banned", "Yasaklı değil"],
  ];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg">Yazar olma başvurusu</h2>
        {latest && <StatusBadge status={latest.status} />}
      </div>

      {latest?.status === "signed" && (
        <Alert tone="success" title="Yazar oldunuz">
          Başvurunuz tamamlandı ve sözleşmeniz imzalandı. Yazar paneline geçebilirsiniz.
        </Alert>
      )}

      {open && (
        <Alert tone="info">
          <p>
            Başvurunuz {formatDate(latest!.submittedAt)} tarihinde alındı ve değerlendirmede.
            Süreç: editör onayı → yönetim onayı → sözleşme imzası.
          </p>
          {latest!.sampleMediaId && (
            <p className="mt-2">
              <a
                href={`/api/media/${latest!.sampleMediaId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                Örnek eser dosyanız
              </a>
            </p>
          )}
        </Alert>
      )}

      {latest?.status === "admin_approved" && (
        <Alert tone="success" title="Sözleşmeniz hazır">
          <p>
            Başvurunuz yönetim tarafından onaylandı. Son adım, çerçeve sözleşmeyi okuyup
            imzalamak; imzaladığınızda hesabınız yazar rolüne geçer.
          </p>
          <p className="mt-3">
            <Link
              href={`/writer-application/contract?application=${latest!.id}`}
              className="text-accent underline"
            >
              Sözleşmeyi oku ve imzala
            </Link>
          </p>
        </Alert>
      )}

      {(latest?.status === "editor_rejected" || latest?.status === "admin_rejected") && (
        <Alert tone="warning" title="Başvurunuz bu kez kabul edilmedi">
          <p>{latest!.reviewNote ?? "Değerlendirme notu belirtilmedi."}</p>
          {cooldown.retryAt && (
            <p className="mt-2">
              Yeniden başvurabileceğiniz tarih: {formatDate(cooldown.retryAt)}.
            </p>
          )}
        </Alert>
      )}

      {!latest && cooldown.withinCooldown && (
        <Alert tone="warning">
          Son 30 günde bir başvuru yaptınız. Yeniden başvurabileceğiniz tarih:{" "}
          {formatDate(cooldown.retryAt)}.
        </Alert>
      )}

      {!latest && !cooldown.withinCooldown && !ready && (
        <>
          <p className="mb-4 text-sm text-muted">
            Başvuru butonu şu durumlarda etkinleşir:
          </p>
          <ul className="mb-5 space-y-2 text-sm">
            {RULES.map(([id, label]) => {
              const failed = problems.includes(id);
              return (
                <li key={id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={
                      failed
                        ? "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-danger bg-danger-soft text-[10px] leading-none text-danger"
                        : "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-accent bg-accent text-[10px] leading-none text-white"
                    }
                  >
                    {failed ? "✗" : "✓"}
                  </span>
                  <span className={failed ? "text-danger" : "text-ink"}>{label}</span>
                </li>
              );
            })}
          </ul>
          <Alert tone="warning" title="Eksik koşullar var">
            <ul className="mt-1 list-disc pl-5">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
          <button
            type="button"
            disabled
            className="mt-4 cursor-not-allowed rounded-md border border-line bg-surface px-4 py-2 text-sm text-muted/50"
          >
            Yazar Olma İsteği Gönder
          </button>
        </>
      )}

      {!latest && !cooldown.withinCooldown && ready && (
        <>
          <p className="mb-4 text-sm text-muted">
            Örnek bir yazınızı (PDF veya DOCX, en fazla 20 MB) yükleyin. Başvuru önce
            editörlerimize, ardından yönetime gider; onaylanırsa sözleşme imzasına davet
            edilirsiniz.
          </p>

          <PanelForm
            action={submitWriterApplicationAction}
            csrfToken={csrfToken}
            submitLabel="Yazar Olma İsteği Gönder"
          >
            <Field label="Örnek eser dosyası" htmlFor="sampleFile">
              <Input
                id="sampleFile"
                name="sampleFile"
                type="file"
                required
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
            </Field>
            <Field label="Not (isteğe bağlı)" htmlFor="note">
              <Textarea
                id="note"
                name="note"
                maxLength={2000}
                placeholder="Örnek eseriniz hakkında birkaç cümle…"
              />
            </Field>
          </PanelForm>
        </>
      )}
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

/**
 * The duty card on the account page. A writer or editor can freeze their own
 * duty: the panel closes, every record (signed rights grants, acceptances)
 * stays, and an admin reactivates the duty. A frozen user only sees the state;
 * there is no self-unfreeze, so the freeze is a real commitment (D-039).
 */
export function DutyCard({
  csrfToken,
  role,
  frozen,
}: {
  csrfToken: string;
  role: SessionUser["role"];
  frozen: boolean;
}) {
  if (role !== "writer" && role !== "editor") return null;

  return (
    <Card>
      <h2 className="mb-4 font-serif text-lg">Görev durumu</h2>

      {frozen ? (
        <Alert tone="warning" title="Göreviniz donduruldu">
          Paneliniz kapatıldı; görev kayıtlarınız korunuyor. Görevinizi yeniden
          aktifleştirmek için bir yöneticiye başvurun.
        </Alert>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Görevinizi dondurursanız paneliniz kapanır; imzaladığınız sözleşme ve hak devri
            kayıtları korunur. Yeniden aktifleştirme bir yönetici gerektirir.
          </p>
          <ActionButton
            action={selfFreezeDutyAction}
            csrfToken={csrfToken}
            label="Görevimi dondur"
            variant="danger"
            confirmMessage="Görevinizi dondurmak istiyor musunuz? Paneliniz kapanacak ve yeniden açılması için yönetici onayı gerekecek."
          />
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

/**
 * The TOTP second factor block (D-048). The setup form receives a freshly
 * generated secret from the server page; once the authenticator app holds it,
 * the code the user types proves the app received it, and only then is the
 * secret stored.
 */
export function TwoFactorCard({
  csrfToken,
  enabled,
  pendingSecret,
  pendingUri,
  pendingQrUrl,
}: {
  csrfToken: string;
  enabled: boolean;
  /** A fresh secret to scan; only generated when 2FA is off. */
  pendingSecret: string;
  pendingUri: string;
  /** A data URL of the QR code for the setup URI, when 2FA is off. */
  pendingQrUrl: string;
}) {
  if (enabled) {
    return (
      <Card>
        <h2 className="mb-3 font-serif text-lg">İki adımlı doğrulama</h2>
        <div className="mb-4">
          <Alert tone="success" title="Açık">
            Girişinizde kimlik doğrulayıcı kodunuz da istenir.
          </Alert>
        </div>

        <PanelForm
          action={disableTwoFactorAction}
          csrfToken={csrfToken}
          submitLabel="İki adımlı doğrulamayı kapat"
          submitVariant="secondary"
        >
          <>
            <Field label="Mevcut şifre" htmlFor="totpCurrentPassword">
              <Input
                id="totpCurrentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Doğrulama kodu" htmlFor="totpCode">
              <Input
                id="totpCode"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
            </Field>
          </>
        </PanelForm>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 font-serif text-lg">İki adımlı doğrulama</h2>
      <p className="mb-4 text-sm text-muted">
        Editör ve yönetici hesapları için zorunludur. Kimlik doğrulayıcı
        uygulamanızda (Google Authenticator, 1Password, Aegis vb.) aşağıdaki
        kodu taratın, sonra uygulamanın ürettiği kodu buraya yazın.
      </p>

      <div className="mb-4 rounded-md border border-line bg-paper p-4">
        {pendingQrUrl ? (
          <Image
            src={pendingQrUrl}
            alt="Kimlik doğrulayıcı uygulamanıza ekleyeceğiniz QR kod"
            width={176}
            height={176}
            unoptimized
            className="mx-auto mb-3 h-44 w-44 rounded bg-white p-2"
          />
        ) : null}
        <p className="mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
          Taratamıyorsanız girebileceğiniz bağlantı
        </p>
        <p className="break-all font-mono text-xs text-ink">{pendingUri}</p>
        <p className="mt-3 mb-1 text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
          Gizli anahtar (elle girmek isterseniz)
        </p>
        <p className="break-all font-mono text-xs text-ink">{pendingSecret}</p>
      </div>

      <PanelForm
        action={enableTwoFactorAction}
        csrfToken={csrfToken}
        submitLabel="Doğrulamayı aç"
      >
        <>
          <input type="hidden" name="pendingSecret" value={pendingSecret} />
          <Field label="Mevcut şifre" htmlFor="totpSetupPassword">
            <Input
              id="totpSetupPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="Doğrulama kodu" htmlFor="totpSetupCode">
            <Input
              id="totpSetupCode"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </Field>
        </>
      </PanelForm>
    </Card>
  );
}

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
