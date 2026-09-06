import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireSession } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { navForRole, PanelShell } from "@/components/shell";
import { ActionButton } from "@/components/form";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PasswordCard, ProfileCard, SessionsCard } from "@/components/account-forms";
import { formatDate } from "@/lib/utils";
import { cancelDeletionAction, requestDeletionAction } from "./actions";

export const metadata = { title: "Hesabım" };

/**
 * The home of a plain registered reader: profile, password, sessions.
 * There is no self-service route from here to the writer role by design (§3).
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const context = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const params = await searchParams;

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;
  const sessions = await listSessions(context.user.id);

  // Every role can open this page, so the sidebar has to be the one that role
  // came from; otherwise an admin loses the panel navigation on the way here.
  const nav = navForRole(context.user.role);

  return (
    <PanelShell user={context.user} area={nav.area} items={nav.items}>
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

        {profile.role === "user" && (
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
