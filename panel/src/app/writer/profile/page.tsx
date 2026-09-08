import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { guardPanel } from "@/lib/auth/guard";
import { listSessions } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { PasswordCard, ProfileCard, SessionsCard } from "@/components/account-forms";
import { PageHeader } from "@/components/ui";

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
        description="Yayında görünen bilgileriniz, şifreniz ve açık oturumlarınız."
      />

      <div className="space-y-6">
        <ProfileCard
          csrfToken={csrfToken}
          user={context.user}
          bio={profile.bio}
          socialLinks={profile.socialLinks ?? null}
          phone={profile.phone}
        />

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
