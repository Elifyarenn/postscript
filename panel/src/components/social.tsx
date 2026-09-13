/**
 * The pieces the community screens share (D-089): the avatar stand-in, the
 * profile header and the member list.
 *
 * A member is always shown by pen name or handle, never by display name: the
 * handle exists so the community does not see a legal name.
 */
import Link from "next/link";
import { cn, formatDateTime } from "@/lib/utils";
import { ActionButton, PanelForm } from "./form";
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

const MONTH_YEAR = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

const AVATAR_SIZES = {
  sm: "size-9 text-sm",
  md: "size-12 text-base",
  lg: "size-24 text-3xl",
} as const;

/**
 * The circle standing in for a profile picture. Uploads need object storage,
 * which production does not have yet, so the initial is used (D-089).
 */
export function Avatar({
  username,
  size = "md",
}: {
  username: string;
  size?: keyof typeof AVATAR_SIZES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-serif text-paper uppercase",
        AVATAR_SIZES[size],
      )}
    >
      {username.charAt(0)}
    </span>
  );
}

export function memberName(member: { username: string; penName: string | null }): string {
  return member.penName ?? member.username;
}

export function MemberLink({
  member,
  className,
}: {
  member: { username: string; penName: string | null };
  className?: string;
}) {
  return (
    <Link href={`/social/u/${member.username}`} className={cn("hover:text-accent", className)}>
      <span className="font-medium">{memberName(member)}</span>{" "}
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
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="h-28 bg-accent sm:h-36" />

      <div className="px-5 pb-5">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3">
          <span className="rounded-full border-4 border-surface">
            <Avatar username={profile.username} size="lg" />
          </span>

          <div className="flex flex-wrap items-center gap-2 pb-1">
            {profile.isSelf ? (
              <>
                <Link
                  href="/account"
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-paper"
                >
                  Profili düzenle
                </Link>
                <Link
                  href="/social/settings"
                  className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-paper"
                >
                  Topluluk ayarları
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
                  />
                ) : (
                  <ActionButton
                    action={followAction}
                    csrfToken={csrfToken}
                    label="Takip et"
                    variant="primary"
                    fields={fields}
                  />
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl">{memberName(profile)}</h1>
          {profile.role !== "user" && <StatusBadge status={profile.role} />}
        </div>
        <p className="text-sm text-muted">
          @{profile.username} · {MONTH_YEAR.format(profile.joinedAt)} tarihinde katıldı
        </p>

        {profile.viewerBlocked && (
          <p className="mt-2 text-sm text-danger">Bu hesabı engellediniz.</p>
        )}
        {profile.followsViewer && <p className="mt-2 text-xs text-muted">Sizi takip ediyor</p>}

        {profile.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{profile.bio}</p>}

        <p className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href={`/social/u/${profile.username}/following`} className="hover:text-accent">
            <strong>{profile.followingCount}</strong> <span className="text-muted">takip</span>
          </Link>
          <Link href={`/social/u/${profile.username}/followers`} className="hover:text-accent">
            <strong>{profile.followerCount}</strong> <span className="text-muted">takipçi</span>
          </Link>
        </p>
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
    <nav className="mt-4 flex flex-wrap gap-1 border-b border-line" aria-label="Profil sekmeleri">
      {PROFILE_TABS.filter(([key]) => key !== "favorites" || isSelf).map(([key, label]) => (
        <Link
          key={key}
          href={`/social/u/${username}?tab=${key}`}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm",
            key === active
              ? "border-accent font-medium text-accent"
              : "border-transparent text-muted hover:text-ink",
          )}
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
}: {
  csrfToken: string;
  replyToId?: string;
}) {
  const id = replyToId ? `reply-${replyToId}` : "new-post";
  return (
    <PanelForm
      action={createPostAction}
      csrfToken={csrfToken}
      submitLabel={replyToId ? "Yanıtla" : "Paylaş"}
    >
      {replyToId && <input type="hidden" name="replyToId" value={replyToId} />}
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
    <article className="border-b border-line py-4 last:border-b-0">
      {post.repostedBy && (
        <p className="mb-1 pl-12 text-xs text-muted">
          <MemberLink member={post.repostedBy} /> yeniden paylaştı
        </p>
      )}

      <div className="flex gap-3">
        <Avatar username={post.author.username} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <MemberLink member={post.author} />
            {post.author.role !== "user" && <StatusBadge status={post.author.role} />}
            <Link href={`/social/posts/${post.id}`} className="text-xs text-muted hover:text-ink">
              {formatDateTime(post.createdAt)}
            </Link>
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
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">{post.body}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Link
              href={`/social/posts/${post.id}`}
              className="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-paper hover:text-ink"
            >
              Yanıtla ({post.replyCount})
            </Link>
            <ActionButton
              action={post.viewerLiked ? unlikePostAction : likePostAction}
              csrfToken={csrfToken}
              label={`${post.viewerLiked ? "Beğenildi" : "Beğen"} (${post.likeCount})`}
              variant="ghost"
              fields={fields}
            />
            <ActionButton
              action={post.viewerReposted ? unrepostAction : repostAction}
              csrfToken={csrfToken}
              label={`${post.viewerReposted ? "Yeniden paylaşıldı" : "Yeniden paylaş"} (${post.repostCount})`}
              variant="ghost"
              fields={fields}
            />
            <ActionButton
              action={post.viewerBookmarked ? removePostBookmarkAction : bookmarkPostAction}
              csrfToken={csrfToken}
              label={post.viewerBookmarked ? "Kaydedildi" : "Kaydet"}
              variant="ghost"
              fields={fields}
            />
            {post.isOwn ? (
              <ActionButton
                action={deletePostAction}
                csrfToken={csrfToken}
                label="Sil"
                variant="ghost"
                fields={fields}
                confirmMessage="Gönderi silinsin mi?"
              />
            ) : (
              <Link
                href={`/social/report?type=post&id=${post.id}`}
                className="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-paper hover:text-danger"
              >
                Bildir
              </Link>
            )}
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
    <div>
      {posts.map((post) => (
        <PostCard key={`${post.id}:${post.repostedBy?.username ?? ""}`} post={post} csrfToken={csrfToken} />
      ))}
    </div>
  );
}

export function MemberList({ members }: { members: MemberListItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {members.map((member) => (
        <li key={member.username} className="flex items-center gap-3 py-3">
          <Avatar username={member.username} size="sm" />
          <MemberLink member={member} className="text-sm" />
          {member.role !== "user" && <StatusBadge status={member.role} />}
        </li>
      ))}
    </ul>
  );
}
