import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { getProfile } from "@/services/social";
import { listProfilePosts } from "@/services/posts";
import { Card } from "@/components/ui";
import { parseProfileTab, PostList, ProfileHeader, ProfileTabs } from "@/components/social";

export const metadata = { title: "Profil" };

const EMPTY_TEXT = {
  posts: "Henüz gönderi yok.",
  replies: "Henüz yanıt yok.",
  favorites: "Henüz beğenilen gönderi yok.",
} as const;

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { username } = await params;

  const profile = await getProfile({ ...user }, decodeURIComponent(username)).catch(
    (error: unknown) => {
      if (isAppError(error) && error.status === 404) notFound();
      throw error;
    },
  );

  // Likes belong to the owner alone (D-090); anyone else lands on the posts tab
  let tab = parseProfileTab((await searchParams).tab);
  if (tab === "favorites" && !profile.isSelf) tab = "posts";

  return (
    <>
      <ProfileHeader profile={profile} csrfToken={csrfToken} />
      <ProfileTabs username={profile.username} active={tab} isSelf={profile.isSelf} />

      <Card className="mt-4">
        {tab === "about" ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">Biyografi</dt>
              <dd className="whitespace-pre-wrap">{profile.bio ?? "Biyografi eklenmemiş."}</dd>
            </div>
            <div>
              <dt className="text-muted">Katılım</dt>
              <dd>{formatDate(profile.joinedAt)}</dd>
            </div>
          </dl>
        ) : (
          <PostList
            posts={await listProfilePosts({ ...user }, profile.username, tab)}
            csrfToken={csrfToken}
            empty={EMPTY_TEXT[tab]}
          />
        )}
      </Card>
    </>
  );
}
