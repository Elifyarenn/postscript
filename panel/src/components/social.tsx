/**
 * The pieces the community screens share (D-089), drawn in the magazine
 * frame's look since D-113: the avatar stand-in, the profile header and tabs,
 * the post card and the member list.
 *
 * A member is shown by nickname or handle, never by display name or pen name:
 * the handle exists so the community does not see a legal name, and the pen
 * name belongs to the magazine (D-163).
 */
import Link from "next/link";
import { Bookmark, Heart, Link as LinkIcon, MessageCircle, Repeat2, Star } from "lucide-react";
import { communityName } from "@/lib/nickname";
import { formatMonthYear, formatRelativeTime } from "@/lib/relative-time";
import { cn, formatDateTime } from "@/lib/utils";
import { ActionButton, PanelForm } from "./form";
import { ProfileEditor } from "./profile-editor";
import { Sparkle } from "./site-ui";
import { Field, StatusBadge, Textarea } from "./ui";
import {
  blockAction,
  bookmarkPostAction,
  createPostAction,
  deletePostAction,
  followAction,
  likePostAction,
  removePostBookmarkAction,
  repostAction,
  unblockAction,
  unfollowAction,
  unlikePostAction,
  unrepostAction,
} from "@/app/social/actions";
import { MAX_POST_LENGTH, type PostView } from "@/services/posts";
import type { MemberListItem, ProfileView } from "@/services/social";

const AVATAR_SIZES = {
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-24 text-3xl",
  xl: "profile-avatar-circle",
} as const;

/**
 * The circle standing in for a profile picture. Uploads need object storage,
 * which production does not have yet, so the initial is used (D-089).
 */
export function Avatar({
  username,
  size = "md",
  imageUrl,
}: {
  username: string;
  size?: keyof typeof AVATAR_SIZES;
  /** The member's own picture; without one the initial stands in (D-141). */
  imageUrl?: string | null;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent font-serif text-paper uppercase",
        AVATAR_SIZES[size],
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        username.charAt(0)
      )}
    </span>
  );
}

/** The community shows the nickname, never the pen name, which is the magazine's (D-163). */
export function memberName(member: { username: string; nickname: string | null }): string {
  return communityName(member);
}

export function MemberLink({
  member,
  className,
}: {
  member: { username: string; nickname: string | null };
  className?: string;
}) {
  return (
    <Link href={`/social/u/${member.username}`} className={cn("hover:text-accent", className)}>
      <span className="member-name font-medium">{memberName(member)}</span>{" "}
      <span className="text-muted">@{member.username}</span>
    </Link>
  );
}

export function ProfileHeader({
  profile,
  csrfToken,
}: {
  profile: ProfileView;
  csrfToken: string;
}) {
  const fields = { username: profile.username };

  return (
    <section className="profile-card">
      <div className="profile-cover" aria-hidden>
        {profile.headerUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- served by our own media route, not optimised
          <img src={profile.headerUrl} alt="" className="profile-cover-image" />
        )}
      </div>

      <div className="profile-main">
        <span className="profile-avatar">
          <Avatar username={profile.username} size="xl" imageUrl={profile.avatarUrl} />
        </span>

        <div className="profile-identity">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="profile-name">{memberName(profile)}</h1>
            <Star aria-hidden className="profile-name-star" fill="currentColor" />
            {profile.role !== "user" && <StatusBadge status={profile.role} />}
          </div>
          <p className="profile-handle">
            @{profile.username} · {formatMonthYear(profile.joinedAt)} tarihinde katıldı
          </p>

          {profile.viewerBlocked && (
            <p className="mt-2 text-sm text-danger">Bu hesabı engellediniz.</p>
          )}
          {profile.followsViewer && <p className="mt-2 text-xs text-muted">Sizi takip ediyor</p>}

          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          <Link href={`/social/u/${profile.username}?tab=about`} className="profile-more">
            <LinkIcon aria-hidden className="size-4" /> Hakkında daha fazlası
          </Link>
        </div>

        <Sparkle className="profile-star" />

        <div className="profile-side">
          <p className="profile-stats">
            <Link href={`/social/u/${profile.username}`}>
              <strong>{profile.postCount}</strong> <span>gönderi</span>
            </Link>
            <Link href={`/social/u/${profile.username}/followers`}>
              <strong>{profile.followerCount}</strong> <span>takipçi</span>
            </Link>
            <Link href={`/social/u/${profile.username}/following`}>
              <strong>{profile.followingCount}</strong> <span>takip</span>
            </Link>
          </p>

          <div className="profile-actions">
            {profile.isSelf ? (
              <>
                {/* Edited where it is seen, in one dialog with one save, as on X (D-160) */}
                <ProfileEditor
                  profile={{
                    username: profile.username,
                    nickname: profile.nickname,
                    bio: profile.bio,
                    avatarUrl: profile.avatarUrl,
                    headerUrl: profile.headerUrl,
                  }}
                  csrfToken={csrfToken}
                  triggerClassName="profile-link"
                />
                <Link href="/account" className="profile-link">
                  Hesabım
                </Link>
              </>
            ) : profile.viewerBlocked ? (
              <ActionButton
                action={unblockAction}
                csrfToken={csrfToken}
                label="Engeli kaldır"
                fields={fields}
              />
            ) : (
              <>
                {profile.viewerFollows ? (
                  <ActionButton
                    action={unfollowAction}
                    csrfToken={csrfToken}
                    label="Takibi bırak"
                    fields={fields}
                    className="profile-follow is-following"
                    display={
                      <>
                        <Star aria-hidden className="size-5" fill="currentColor" />
                        Takibi bırak
                      </>
                    }
                  />
                ) : (
                  <ActionButton
                    action={followAction}
                    csrfToken={csrfToken}
                    label="Takip et"
                    variant="primary"
                    fields={fields}
                    className="profile-follow"
                    display={
                      <>
                        <Star aria-hidden className="size-5" fill="currentColor" />
                        Takip et
                      </>
                    }
                  />
                )}
                <Link href={`/social/messages/${profile.username}`} className="profile-link">
                  Mesaj
                </Link>
                {profile.anonBoxEnabled && (
                  <Link href={`/social/anon/${profile.username}`} className="profile-link">
                    Anonim mesaj
                  </Link>
                )}
                <ActionButton
                  action={blockAction}
                  csrfToken={csrfToken}
                  label="Engelle"
                  variant="ghost"
                  fields={fields}
                  confirmMessage={`@${profile.username} engellensin mi? Takipleriniz karşılıklı olarak kaldırılır.`}
                />
                <Link
                  href={`/social/report?type=member&id=${profile.id}`}
                  className="px-2 text-xs text-muted hover:text-danger"
                >
                  Bildir
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const PROFILE_TABS = [
  ["posts", "Gönderiler"],
  ["replies", "Yanıtlar"],
  ["favorites", "Beğeniler"],
  ["about", "Hakkında"],
] as const;

export type ProfileTabKey = (typeof PROFILE_TABS)[number][0];

export function parseProfileTab(value: string | undefined): ProfileTabKey {
  return PROFILE_TABS.some(([key]) => key === value) ? (value as ProfileTabKey) : "posts";
}

export function ProfileTabs({
  username,
  active,
  isSelf,
}: {
  username: string;
  active: ProfileTabKey;
  isSelf: boolean;
}) {
  return (
    <nav className="profile-tabs fit-line" aria-label="Profil sekmeleri">
      {PROFILE_TABS.filter(([key]) => key !== "favorites" || isSelf).map(([key, label]) => (
        <Link
          key={key}
          href={`/social/u/${username}?tab=${key}`}
          aria-current={key === active ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PostComposer({
  csrfToken,
  replyToId,
  communityId,
}: {
  csrfToken: string;
  replyToId?: string;
  /** Shares the post in this community (D-093). */
  communityId?: string;
}) {
  const id = replyToId ? `reply-${replyToId}` : communityId ? `community-${communityId}` : "new-post";
  return (
    <PanelForm
      action={createPostAction}
      csrfToken={csrfToken}
      submitLabel={replyToId ? "Yanıtla" : "Paylaş"}
    >
      {replyToId && <input type="hidden" name="replyToId" value={replyToId} />}
      {communityId && <input type="hidden" name="communityId" value={communityId} />}
      <Field
        label={replyToId ? "Yanıtınız" : "Ne düşünüyorsunuz?"}
        htmlFor={id}
        hint={`En çok ${MAX_POST_LENGTH} karakter. Tüm üyelere görünür; topluluk kuralları geçerlidir.`}
      >
        <Textarea
          id={id}
          name="body"
          required
          maxLength={MAX_POST_LENGTH}
          rows={3}
          className="min-h-20 font-sans"
        />
      </Field>
    </PanelForm>
  );
}

export function PostCard({ post, csrfToken }: { post: PostView; csrfToken: string }) {
  const fields = { postId: post.id };

  return (
    <article className="post-card">
      {post.repostedBy && (
        <p className="post-repost">
          <Repeat2 aria-hidden className="size-3.5" />
          <MemberLink member={post.repostedBy} /> yeniden paylaştı
        </p>
      )}

      <div className="flex gap-3">
        <Avatar username={post.author.username} size="md" />
        <div className="min-w-0 flex-1">
          <p className="post-meta">
            <MemberLink member={post.author} />
            {post.author.role !== "user" && <StatusBadge status={post.author.role} />}
            <Link
              href={`/social/posts/${post.id}`}
              className="post-time"
              title={formatDateTime(post.createdAt)}
            >
              · {formatRelativeTime(post.createdAt)}
            </Link>
            {post.community && (
              <Link
                href={`/social/communities/${post.community.slug}`}
                className="text-xs text-accent hover:underline"
              >
                {post.community.name}
              </Link>
            )}
          </p>

          {post.replyTo && (
            <p className="text-xs text-muted">
              Yanıt:{" "}
              {post.replyTo.author ? (
                <Link href={`/social/posts/${post.replyTo.id}`} className="hover:text-ink">
                  @{post.replyTo.author.username}
                </Link>
              ) : (
                "artık görünmeyen bir gönderi"
              )}
            </p>
          )}

          {/* Plain text on purpose: a post is never rendered as HTML or Markdown */}
          <p className="post-body">{post.body}</p>

          <div className="post-actions">
            <Link
              href={`/social/posts/${post.id}`}
              className="post-action"
              aria-label={`Yanıtla (${post.replyCount})`}
              title="Yanıtla"
            >
              <MessageCircle aria-hidden className="size-5" />
              <span aria-hidden>{post.replyCount}</span>
            </Link>
            <ActionButton
              action={post.viewerLiked ? unlikePostAction : likePostAction}
              csrfToken={csrfToken}
              label={`${post.viewerLiked ? "Beğenildi" : "Beğen"} (${post.likeCount})`}
              variant="ghost"
              fields={fields}
              className={cn("post-action", post.viewerLiked && "is-on")}
              display={
                <>
                  <Heart aria-hidden className="size-5" fill={post.viewerLiked ? "currentColor" : "none"} />
                  <span>{post.likeCount}</span>
                </>
              }
            />
            <ActionButton
              action={post.viewerReposted ? unrepostAction : repostAction}
              csrfToken={csrfToken}
              label={`${post.viewerReposted ? "Yeniden paylaşıldı" : "Yeniden paylaş"} (${post.repostCount})`}
              variant="ghost"
              fields={fields}
              className={cn("post-action", post.viewerReposted && "is-on")}
              display={
                <>
                  <Repeat2 aria-hidden className="size-5" />
                  <span>{post.repostCount}</span>
                </>
              }
            />

            <span className="post-actions-end">
              {post.isOwn ? (
                <ActionButton
                  action={deletePostAction}
                  csrfToken={csrfToken}
                  label="Sil"
                  variant="ghost"
                  fields={fields}
                  className="post-small"
                  confirmMessage="Gönderi silinsin mi?"
                />
              ) : (
                <Link href={`/social/report?type=post&id=${post.id}`} className="post-small">
                  Bildir
                </Link>
              )}
              <ActionButton
                action={post.viewerBookmarked ? removePostBookmarkAction : bookmarkPostAction}
                csrfToken={csrfToken}
                label={post.viewerBookmarked ? "Kaydedildi" : "Kaydet"}
                variant="ghost"
                fields={fields}
                className={cn("post-action", post.viewerBookmarked && "is-on")}
                display={
                  <Bookmark
                    aria-hidden
                    className="size-5"
                    fill={post.viewerBookmarked ? "currentColor" : "none"}
                  />
                }
              />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PostList({
  posts,
  csrfToken,
  empty,
}: {
  posts: PostView[];
  csrfToken: string;
  empty: string;
}) {
  if (posts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="post-list">
      {posts.map((post) => (
        <PostCard key={`${post.id}:${post.repostedBy?.username ?? ""}`} post={post} csrfToken={csrfToken} />
      ))}
    </div>
  );
}

export function MemberList({
  members,
  followToken,
}: {
  members: MemberListItem[];
  /**
   * Given on suggestion lists, where nobody listed is followed yet: each row
   * then carries a follow button (D-139). Follower lists leave it out.
   */
  followToken?: string;
}) {
  return (
    <ul className="divide-y divide-line">
      {members.map((member) => (
        <li key={member.username} className="flex flex-wrap items-center gap-3 py-3">
          <Avatar username={member.username} size="sm" />
          <MemberLink member={member} className="text-sm" />
          {member.role !== "user" && <StatusBadge status={member.role} />}
          {followToken && (
            <ActionButton
              action={followAction}
              csrfToken={followToken}
              label="Takip et"
              variant="primary"
              fields={{ username: member.username }}
              className="ml-auto"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
