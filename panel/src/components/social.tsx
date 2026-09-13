/**
 * The pieces the community screens share (D-089): the avatar stand-in, the
 * profile header and the member list.
 *
 * A member is always shown by pen name or handle, never by display name: the
 * handle exists so the community does not see a legal name.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ActionButton } from "./form";
import { StatusBadge } from "./ui";
import {
  blockAction,
  followAction,
  unblockAction,
  unfollowAction,
} from "@/app/social/actions";
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
