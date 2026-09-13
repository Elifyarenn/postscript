/**
 * The community cards and their join button (D-093).
 */
import Link from "next/link";
import { ActionButton } from "./form";
import { joinCommunityAction, leaveCommunityAction } from "@/app/social/actions";
import type { CommunitySummary } from "@/services/communities";

export function MembershipButton({
  community,
  csrfToken,
  canJoin,
}: {
  community: CommunitySummary;
  csrfToken: string;
  /** False without a handle: joining is a social act (D-089). */
  canJoin: boolean;
}) {
  const fields = { slug: community.slug };
  if (community.isMember) {
    return <ActionButton action={leaveCommunityAction} csrfToken={csrfToken} label="Ayrıl" fields={fields} />;
  }
  if (community.archived || !canJoin) return null;
  return (
    <ActionButton
      action={joinCommunityAction}
      csrfToken={csrfToken}
      label="Katıl"
      variant="primary"
      fields={fields}
    />
  );
}

export function CommunityCard({
  community,
  csrfToken,
  canJoin,
}: {
  community: CommunitySummary;
  csrfToken: string;
  canJoin: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="min-w-0 flex-1">
        <Link href={`/social/communities/${community.slug}`} className="font-serif text-lg hover:text-accent">
          {community.name}
        </Link>
        {community.description && <p className="mt-0.5 text-sm text-muted">{community.description}</p>}
        <p className="mt-1 text-xs text-muted">{community.memberCount} üye</p>
      </div>
      <MembershipButton community={community} csrfToken={csrfToken} canJoin={canJoin} />
    </li>
  );
}
