import Link from "next/link";
import { requireSession } from "@/lib/auth/guard";
import { getMemberSettings, getProfile } from "@/services/social";
import { Alert, Card, PageHeader } from "@/components/ui";
import { Avatar, memberName } from "@/components/social";

export const metadata = { title: "Topluluk" };

/** The community's front door. A member without a handle is told how to get one. */
export default async function SocialHomePage() {
  const { user } = await requireSession();
  const { username } = await getMemberSettings({ ...user });

  if (!username) {
    return (
      <>
        <PageHeader title="Topluluk" />
        <Alert tone="info" title="Önce bir kullanıcı adı seçin">
          Toplulukta ad soyadınız yerine kullanıcı adınız görünür. Takip etmek ve takip edilmek
          için bir kullanıcı adı gerekir.{" "}
          <Link href="/social/settings" className="underline">
            Kullanıcı adı seçin
          </Link>
          .
        </Alert>
      </>
    );
  }

  const profile = await getProfile({ ...user }, username);

  return (
    <>
      <PageHeader title="Topluluk" />
      <Card>
        <div className="flex items-center gap-3">
          <Avatar username={profile.username} />
          <div>
            <Link href={`/social/u/${profile.username}`} className="font-serif text-lg hover:text-accent">
              {memberName(profile)}
            </Link>
            <p className="text-sm text-muted">
              @{profile.username} · {profile.followingCount} takip · {profile.followerCount} takipçi
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
