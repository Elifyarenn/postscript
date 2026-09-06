import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { PanelShell } from "@/components/shell";
import { PanelForm, ActionButton } from "@/components/form";
import { Alert, Card, PageHeader } from "@/components/ui";
import {
  PasswordCard,
  ProfileCard,
  SessionsCard,
  TwoFactorCard,
} from "@/components/account-forms";
import { formatDate } from "@/lib/utils";
import {
  cancelDeletionAction,
  requestDeletionAction,
  resendVerificationAction,
} from "./actions";

export const metadata = { title: "Hesabım" };

/**
 * The home of a plain registered reader: profile, password, sessions.
 * There is no self-service route from here to the writer role by design (§3).
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;
  const sessions = await listSessions(context.user.id);

  return (
    <PanelShell
      user={context.user}
      area="hesabım"
      items={[{ href: "/account", label: "Hesabım" }]}
    >
      <PageHeader
        title="Hesabım"
        description="Profil bilgileriniz, şifreniz ve açık oturumlarınız."
      />

      <div className="space-y-6">
        {params.registered && (
          <Alert tone="success" title="Hoş geldiniz">
            Hesabınız oluşturuldu. E-posta adresinizi doğrulayana kadar yalnızca bu sayfayı
            kullanabilirsiniz.
          </Alert>
        )}

        {!profile.emailVerifiedAt && (
          <Card>
            <Alert tone="warning" title="E-posta adresiniz doğrulanmadı">
              Adresinize gönderilen bağlantıya tıklayana kadar profiliniz dışındaki hiçbir işlemi
              yapamazsınız.
            </Alert>
            <div className="mt-4">
              <PanelForm
                action={resendVerificationAction}
                csrfToken={csrfToken}
                submitLabel="Bağlantıyı tekrar gönder"
                submitVariant="secondary"
              >
              </PanelForm>
            </div>
          </Card>
        )}

        {profile.role === "user" && profile.emailVerifiedAt && (
          <Alert tone="info" title="Yazar olmak">
            Yazarlık yetkisini yalnızca yönetici verir; başvuru formu yoktur. Yetkilendirme için
            doğum tarihinizin girilmiş ve kimliğinizin doğrulanmış olması gerekir.
          </Alert>
        )}

        <ProfileCard
          csrfToken={csrfToken}
          user={context.user}
          bio={profile.bio}
          socialLinks={profile.socialLinks ?? null}
        />

        {/* Only the admin role carries a second factor (D-025) */}
        {profile.role === "admin" && (
          <TwoFactorCard
            csrfToken={csrfToken}
            confirmedAt={profile.totpConfirmedAt}
            mandatory
          />
        )}

        <PasswordCard csrfToken={csrfToken} />

        <SessionsCard
          csrfToken={csrfToken}
          sessions={sessions}
          currentSessionId={context.sessionId}
        />

        <Card>
          <h2 className="mb-3 font-serif text-lg">Hesabı sil</h2>

          {profile.deletionRequestedAt ? (
            <>
              <Alert tone="warning">
                Silme talebiniz {formatDate(profile.deletionRequestedAt)} tarihinde alındı. Hesabınız
                talepten 30 gün sonra silinecek.
              </Alert>
              <div className="mt-4">
                <ActionButton
                  action={cancelDeletionAction}
                  csrfToken={csrfToken}
                  label="Talebi iptal et"
                />
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                Talebinizden 30 gün sonra hesabınız silinir. İmzalanmış hak devri kayıtları ve imza
                kanıtları hukuki dayanak gereği saklanır; kişisel verileriniz anonimleştirilir.
              </p>
              <ActionButton
                action={requestDeletionAction}
                csrfToken={csrfToken}
                label="Silme talebi oluştur"
                variant="danger"
                confirmMessage="Hesabınızın silinmesini talep ediyorsunuz. Devam edilsin mi?"
              />
            </>
          )}
        </Card>
      </div>
    </PanelShell>
  );
}
