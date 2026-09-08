import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { navForRole, PanelShell } from "@/components/shell";
import { ActionButton } from "@/components/form";
import { Alert, Card, PageHeader } from "@/components/ui";
import {
  PasswordCard,
  ProfileCard,
  SessionsCard,
  EmailCard,
  WriterApplicationCard,
  DutyCard,
  TwoFactorCard,
} from "@/components/account-forms";
import { formatDate } from "@/lib/utils";
import { checkWriterEligibility } from "@/services/users";
import { cooldownInfo, latestApplication } from "@/services/writer-applications";
import { generateTotpSecret, otpauthUri } from "@/services/two-factor";
import QRCode from "qrcode";
import { cancelDeletionAction, requestDeletionAction } from "./actions";

export const metadata = { title: "Hesabım" };

/**
 * The home of a plain registered reader: profile, password, sessions.
 * There is no self-service route from here to the writer role by design (§3).
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; emailChanged?: string; twoFactor?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;
  const sessions = await listSessions(context.user.id);

  // A fresh secret for the setup form; only needed while 2FA is off. The QR
  // code is generated server side as SVG so nothing client side is required.
  const pendingSecret = profile.totpEnabledAt === null ? generateTotpSecret() : "";
  const pendingUri = pendingSecret ? otpauthUri(pendingSecret, profile.email) : "";
  const pendingQrUrl =
    pendingSecret && pendingUri
      ? `data:image/svg+xml;base64,${Buffer.from(
          await QRCode.toString(pendingUri, { type: "svg", width: 176, margin: 1 }),
        ).toString("base64")}`
      : "";

  // The writer application block: prerequisites, cooldown and current status
  const eligibility = checkWriterEligibility(profile);
  const [cooldown, latest] = await Promise.all([
    cooldownInfo(profile.id),
    latestApplication(profile.id),
  ]);

  // Every role can open this page, so the sidebar has to be the one that role
  // came from; otherwise an admin loses the panel navigation on the way here.
  const nav = navForRole(context.user.role);

  return (
    <PanelShell user={context.user} area={nav.area} groups={nav.groups}>
      <PageHeader
        title="Hesabım"
        description="Profil bilgileriniz, şifreniz ve açık oturumlarınız."
      />

      <div className="space-y-6">
        {params.verified && (
          <Alert tone="success" title="Hoş geldiniz">
            E-posta adresiniz doğrulandı, hesabınız kullanıma hazır.
          </Alert>
        )}

        {params.emailChanged && (
          <Alert tone="success" title="E-posta adresi güncellendi">
            E-posta adresiniz değiştirildi ve doğrulandı.
          </Alert>
        )}

        {params.twoFactor && (
          <Alert tone="warning" title="İki adımlı doğrulama zorunlu">
            Editör ve yönetici panellerine girebilmek için önce iki adımlı
            doğrulamayı açmanız gerekiyor. Aşağıdaki karttan kurun; kurulumdan
            sonra yeniden giriş yapmanız istenecek.
          </Alert>
        )}

        {profile.role === "user" && (
          <Alert tone="info" title="Yazar olmak">
            Yazarlık yetkisi başvuruyla ve iki aşamalı onaydan (editör → yönetim) sonra
            sözleşmenin imzalanmasıyla kazanılır. Başvurmadan önce doğum tarihinizin girilmiş
            olması gerekir.
          </Alert>
        )}

        <WriterApplicationCard
          csrfToken={csrfToken}
          role={profile.role}
          problems={eligibility.problems}
          messages={eligibility.messages}
          latest={latest}
          cooldown={cooldown}
        />

        <ProfileCard
          csrfToken={csrfToken}
          user={context.user}
          bio={profile.bio}
          socialLinks={profile.socialLinks ?? null}
          writerArea={profile.writerArea}
        />

        <EmailCard
          csrfToken={csrfToken}
          email={profile.email}
          pendingEmail={profile.pendingEmail}
        />

        <DutyCard
          csrfToken={csrfToken}
          role={profile.role}
          frozen={profile.writerStatus === "suspended" || profile.editorStatus === "suspended"}
        />

        <PasswordCard csrfToken={csrfToken} />

        <TwoFactorCard
          csrfToken={csrfToken}
          enabled={profile.totpEnabledAt !== null}
          pendingSecret={pendingSecret}
          pendingUri={pendingUri}
          pendingQrUrl={pendingQrUrl}
        />

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
