import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { canModerateCommunity } from "@/lib/auth/rbac";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { formatMonthYear, formatRelativeTime } from "@/lib/relative-time";
import { getProfile } from "@/services/social";
import {
  listProfileComments,
  listProfileFeed,
  listProfilePosts,
  type ProfileFeed,
  type PostView,
} from "@/services/posts";
import { listCategoryCounts } from "@/services/public";
import {
  Avatar,
  memberName,
  parseProfileTab,
  PostList,
  ProfileHeader,
  ProfileTabs,
} from "@/components/social";
import { Pager, Sparkle } from "@/components/site-ui";

export const metadata = { title: "Profil" };

const EMPTY_TEXT = {
  posts: "Henüz gönderi yok.",
  replies: "Henüz yanıt yok.",
  favorites: "Henüz beğenilen gönderi yok.",
} as const;

/** The design's "featured post": the member's own most liked post. */
function pickFeatured(posts: PostView[]): PostView | null {
  return (
    posts
      .filter((post) => post.repostedBy === null && post.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)[0] ?? null
  );
}

/**
 * A member's page, the design's "blog": header, tabs, posts with a pager and a
 * side column of recent comments, categories and a featured post (D-113,
 * D-116, D-150).
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; sayfa?: string }>;
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
  const query = await searchParams;
  let tab = parseProfileTab(query.tab);
  if (tab === "favorites" && !profile.isSelf) tab = "posts";

  const [feed, ownPosts, categories, comments] = await Promise.all([
    tab === "about"
      ? Promise.resolve<ProfileFeed | null>(null)
      : listProfileFeed({ ...user }, profile.username, tab, Number.parseInt(query.sayfa ?? "1", 10)),
    // The side column's featured post always comes from the member's own posts,
    // whichever tab and page the reader is on
    listProfilePosts({ ...user }, profile.username, "posts"),
    listCategoryCounts(),
    listProfileComments({ ...user }, profile.username),
  ]);
  const featured = pickFeatured(ownPosts);

  const pageHref = (page: number) =>
    `/social/u/${encodeURIComponent(profile.username)}?tab=${tab}${page > 1 ? `&sayfa=${page}` : ""}`;

  return (
    <>
      <ProfileHeader profile={profile} csrfToken={csrfToken} />
      <ProfileTabs username={profile.username} active={tab} isSelf={profile.isSelf} />

      <div className="profile-body">
        <div className="min-w-0">
          {tab === "about" || !feed ? (
            <dl className="aside-card space-y-3 text-sm">
              <div>
                <dt className="text-muted">Biyografi</dt>
                <dd className="whitespace-pre-wrap">{profile.bio ?? "Biyografi eklenmemiş."}</dd>
              </div>
              <div>
                <dt className="text-muted">Katılım</dt>
                <dd>{formatMonthYear(profile.joinedAt)}</dd>
              </div>
            </dl>
          ) : (
            <>
              <PostList
                posts={feed.posts}
                csrfToken={csrfToken}
                empty={EMPTY_TEXT[tab]}
                canModerate={canModerateCommunity(user)}
              />
              {/* The design puts the pager in the side column; it sits under the
                  list it moves, where it says what it does (D-150) */}
              <Pager page={feed.page} pageCount={feed.pageCount} href={pageHref} />
            </>
          )}
        </div>

        <aside className="profile-aside" aria-label="Yan sütun">
          <section className="aside-card" aria-labelledby="comments-title">
            <h2 id="comments-title">Son yorumlar</h2>
            {comments.length === 0 ? (
              <p className="aside-empty">Henüz yorum yok.</p>
            ) : (
              <ul className="aside-comments">
                {comments.map((comment) => (
                  <li key={comment.id}>
                    <Avatar username={comment.author.username} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/social/u/${comment.author.username}`}
                        className="comment-author"
                      >
                        {memberName(comment.author)}
                      </Link>
                      <p className="comment-body">
                        <Link href={`/social/posts/${comment.id}`}>{comment.body}</Link>
                      </p>
                      <p className="comment-time">{formatRelativeTime(comment.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="aside-card" aria-labelledby="categories-title">
            <h2 id="categories-title">Kategoriler</h2>
            {categories.length === 0 ? (
              <p className="aside-empty">Henüz yayımlanmış yazı yok.</p>
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

          <section className="aside-card" aria-labelledby="featured-title">
            <h2 id="featured-title">Öne çıkan gönderi</h2>
            {featured ? (
              <>
                <div className="featured-row">
                  {/* Posts carry no pictures yet, so the design's image is a plain block */}
                  <span className="featured-cover" aria-hidden>
                    <Sparkle />
                  </span>
                  <div className="min-w-0">
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
                  </div>
                </div>
                <Link href={`/social/posts/${featured.id}`} className="site-more mt-3">
                  Gönderiye git <ArrowRight aria-hidden />
                </Link>
              </>
            ) : (
              <p className="aside-empty">Henüz öne çıkan gönderi yok.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
