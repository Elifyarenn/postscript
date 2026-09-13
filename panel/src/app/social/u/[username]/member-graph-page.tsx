import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { isAppError } from "@/lib/errors";
import { listFollowers, listFollowing } from "@/services/social";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MemberList } from "@/components/social";

/** The followers and following lists are the same screen pointing both ways. */
export async function MemberGraphPage({
  username: rawUsername,
  direction,
}: {
  username: string;
  direction: "followers" | "following";
}) {
  const { user } = await requireSession();
  const username = decodeURIComponent(rawUsername);
  const load = direction === "followers" ? listFollowers : listFollowing;

  const members = await load({ ...user }, username).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  return (
    <>
      <PageHeader
        title={direction === "followers" ? "Takipçiler" : "Takip edilenler"}
        description={`@${username}`}
        actions={
          <Link href={`/social/u/${username}`} className="text-sm text-accent">
            Profile dön
          </Link>
        }
      />
      <Card>
        {members.length === 0 ? (
          <EmptyState>
            {direction === "followers" ? "Henüz takipçi yok." : "Henüz kimse takip edilmiyor."}
          </EmptyState>
        ) : (
          <MemberList members={members} />
        )}
      </Card>
    </>
  );
}
