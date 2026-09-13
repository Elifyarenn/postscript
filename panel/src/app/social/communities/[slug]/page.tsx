import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { getCommunity } from "@/services/communities";
import { listCommunityPosts } from "@/services/posts";
import { getMemberSettings } from "@/services/social";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PostComposer, PostList } from "@/components/social";
import { MembershipButton } from "@/components/communities";

export const metadata = { title: "Topluluk" };

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const { slug } = await params;

  const community = await getCommunity({ ...user }, decodeURIComponent(slug)).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });
  const [posts, settings] = await Promise.all([
    listCommunityPosts({ ...user }, community.id),
    getMemberSettings({ ...user }),
  ]);

  return (
    <>
      <PageHeader
        title={community.name}
        description={community.description ?? undefined}
        actions={
          <MembershipButton community={community} csrfToken={csrfToken} canJoin={settings.username !== null} />
        }
      />

      <div className="space-y-6">
        <p className="text-sm text-muted">{community.memberCount} üye</p>

        {community.archived ? (
          <Alert tone="warning">Bu topluluk arşivlendi; yeni üye ve gönderi kabul etmiyor.</Alert>
        ) : !settings.username ? (
          <Alert tone="info">
            Katılmak ve paylaşmak için{" "}
            <Link href="/social/settings" className="underline">
              bir kullanıcı adı seçin
            </Link>
            .
          </Alert>
        ) : community.isMember ? (
          <Card>
            <PostComposer csrfToken={csrfToken} communityId={community.id} />
          </Card>
        ) : (
          <Alert tone="info">Bu toplulukta paylaşmak için önce katılın.</Alert>
        )}

        <Card>
          <PostList posts={posts} csrfToken={csrfToken} empty="Bu toplulukta henüz gönderi yok." />
        </Card>
      </div>
    </>
  );
}
