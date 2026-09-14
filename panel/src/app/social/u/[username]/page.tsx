import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/utils";
import { getProfile } from "@/services/social";
import { listProfilePosts, type PostView } from "@/services/posts";
import { listCategoryCounts } from "@/services/public";
import { parseProfileTab, PostList, ProfileHeader, ProfileTabs } from "@/components/social";

export const metadata = { title: "Profil" };

const EMPTY_TEXT = {
  posts: "Henüz gönderi yok.",
  replies: "Henüz yanıt yok.",
  favorites: "Henüz beğenilen gönderi yok.",
} as const;

/** A member's page, the design's "blog": header, tabs, posts and a side column (D-113). */
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

  const [posts, categories] = await Promise.all([
    tab === "about"
      ? Promise.resolve<PostView[]>([])
      : listProfilePosts({ ...user }, profile.username, tab),
    listCategoryCounts(),
  ]);

  // The design's "featured post": the member's own most liked post on this page
  const featured =
    tab === "posts"
      ? (posts
          .filter((post) => post.repostedBy === null && post.likeCount > 0)
          .sort((a, b) => b.likeCount - a.likeCount)[0] ?? null)
      : null;

  return (
    <>
      <ProfileHeader profile={profile} csrfToken={csrfToken} />
      <ProfileTabs username={profile.username} active={tab} isSelf={profile.isSelf} />

      <div className="profile-body">
        <div className="min-w-0">
          {tab === "about" ? (
            <dl className="aside-card space-y-3 text-sm">
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
            <PostList posts={posts} csrfToken={csrfToken} empty={EMPTY_TEXT[tab]} />
          )}
        </div>

        <aside className="profile-aside" aria-label="Yan sütun">
          {featured && (
            <section className="aside-card" aria-labelledby="featured-title">
              <h2 id="featured-title">Öne çıkan gönderi</h2>
              <p className="featured-body">{featured.body}</p>
              <p className="featured-meta">
                <span>
                  <Heart aria-hidden className="size-4" /> {featured.likeCount}
                </span>
                <span>
                  <MessageCircle aria-hidden className="size-4" /> {featured.replyCount}
                </span>
                <span>
                  <Repeat2 aria-hidden className="size-4" /> {featured.repostCount}
                </span>
              </p>
              <Link href={`/social/posts/${featured.id}`} className="site-more mt-3">
                Gönderiye git <ArrowRight aria-hidden />
              </Link>
            </section>
          )}

          <section className="aside-card" aria-labelledby="categories-title">
            <h2 id="categories-title">Kategoriler</h2>
            {categories.length === 0 ? (
              <p className="text-sm text-muted">Henüz yayımlanmış yazı yok.</p>
            ) : (
              <ul className="aside-categories">
                {categories.slice(0, 10).map((item) => (
                  <li key={item.category}>
                    <Link href={`/magazine?kategori=${encodeURIComponent(item.category)}`}>
                      <span>{item.category}</span>
                      <span className="aside-count">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
