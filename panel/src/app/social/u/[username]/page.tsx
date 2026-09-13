import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { getProfile } from "@/services/social";
import { ProfileHeader } from "@/components/social";

export const metadata = { title: "Profil" };

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { username } = await params;

  const profile = await getProfile({ ...user }, decodeURIComponent(username)).catch(
    (error: unknown) => {
      if (isAppError(error) && error.status === 404) notFound();
      throw error;
    },
  );

  return <ProfileHeader profile={profile} csrfToken={csrfToken} />;
}
