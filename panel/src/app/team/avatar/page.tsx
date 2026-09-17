import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { getOwnTeamAvatar, isTeamMember } from "@/services/team-avatars";
import { TeamAvatarBuilder } from "@/components/team-avatar-builder";
import styles from "@/components/team-avatar-builder.module.css";

export const metadata: Metadata = {
  title: "Ekip avatarı",
  robots: { index: false, follow: false },
};

/**
 * The team avatar builder (D-194). A page of its own, outside the site frame
 * and the panels, with its own look; it shares only the session, the CSRF
 * token and the service layer with the rest of the application.
 */
export default async function TeamAvatarPage() {
  const { user } = await requireSession();

  if (!(await isTeamMember({ ...user }))) {
    return (
      <main className={styles.page}>
        <div className={styles.closed}>
          <p className={styles.eyebrow}>postscript · ekip</p>
          <h1 className={styles.closedTitle}>Bu sayfa yalnızca dergi ekibine açık</h1>
          <p>
            Avatar oluşturucuyu yazarlar, editörler, çizerler ve yöneticiler kullanabilir. Ekipte
            olduğunuz hâlde bu mesajı görüyorsanız yönetimle iletişime geçin.
          </p>
          <Link href="/" className={styles.secondaryButton}>
            Ana sayfaya dön
          </Link>
        </div>
      </main>
    );
  }

  const [saved, csrfToken] = await Promise.all([getOwnTeamAvatar({ ...user }), readCsrfToken()]);

  return (
    <TeamAvatarBuilder
      csrfToken={csrfToken ?? ""}
      account={{ name: user.penName ?? user.displayName, email: user.email }}
      saved={
        saved
          ? { displayName: saved.displayName, teamRole: saved.teamRole, config: saved.config, updatedAt: saved.updatedAt.toISOString() }
          : null
      }
    />
  );
}
