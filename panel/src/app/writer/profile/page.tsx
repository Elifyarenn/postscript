import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { PasswordCard, ProfileCard, SessionsCard } from "@/components/account-forms";
import { ActionButton } from "@/components/form";
import { Alert, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { disableTotpAction } from "@/app/account/actions";

export const metadata = { title: "Profil ve güvenlik" };

export default async function WriterProfilePage() {
  const context = await guardPanel("writer");
  const csrfToken = (await readCsrfToken()) ?? "";

  const rows = await db.select().from(users).where(eq(users.id, context.user.id)).limit(1);
  const profile = rows[0]!;
  const sessions = await listSessions(context.user.id);

  return (
    <>
      <PageHeader
        title="Profil ve güvenlik"
        description="Yayında görünen bilgileriniz, şifreniz, iki adımlı doğrulama ve oturumlarınız."
      />

      <div className="space-y-6">
        <ProfileCard
          csrfToken={csrfToken}
          user={context.user}
          bio={profile.bio}
          socialLinks={profile.socialLinks ?? null}
        />

        <Card>
          <h2 className="mb-3 font-serif text-lg">İki adımlı doğrulama</h2>

          {profile.totpConfirmedAt ? (
            <>
              <Alert tone="success">
                {formatDateTime(profile.totpConfirmedAt)} tarihinde açıldı.
              </Alert>
              <div className="mt-4">
                <ActionButton
                  action={disableTotpAction}
                  csrfToken={csrfToken}
                  label="Kapat"
                  variant="danger"
                  confirmMessage="İki adımlı doğrulama kapatılacak. Devam edilsin mi?"
                />
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                Yazar hesapları için isteğe bağlıdır, ama hesabınızı belirgin biçimde güvenli hale
                getirir.
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

        <PasswordCard csrfToken={csrfToken} />

        <SessionsCard
          csrfToken={csrfToken}
          sessions={sessions}
          currentSessionId={context.sessionId}
        />
      </div>
    </>
  );
}
