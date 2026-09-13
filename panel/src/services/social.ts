/**
 * The social graph (D-089): community handles, profiles, follows, blocks and
 * the private reading list.
 *
 * Nothing social works before a member picks a handle. The handle is what the
 * community sees instead of the legal name, so a member without one simply has
 * no presence to follow, message or block.
 *
 * Follows and blocks are deliberately not written to `audit_log`: that trail
 * lives ten years and cannot be deleted, and a social graph the member later
 * retracts must not outlive the retraction there.
 */
import "server-only";
import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  bookmarks,
  follows,
  userBlocks,
  users,
  type DmPolicy,
  type Role,
} from "@/db/schema";
import { writeAudit, type Executor } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { normalizeUsername, usernameProblem } from "@/lib/username";
import { assertMayPost } from "./community";
import { notify } from "./notifications";
import type { RequestMeta } from "./auth";

/** A member as the community may see them: never the legal name. */
export type Member = {
  id: string;
  username: string;
  penName: string | null;
  role: Role;
};

/**
 * The actor as a community member. Social actions start here: the account has
 * to be operational (D-072) and must have picked a handle.
 */
export async function requireMember(actor: Actor): Promise<Member> {
  assertMayPost(actor);

  const rows = await db
    .select({ id: users.id, username: users.username, penName: users.penName, role: users.role })
    .from(users)
    .where(and(eq(users.id, actor.id), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("Hesap bulunamadı.");
  if (!row.username) {
    throw conflict("Önce topluluk ayarlarından bir kullanıcı adı seçmeniz gerekiyor.");
  }
  return { ...row, username: row.username };
}

/** A banned or deleted account has no profile to reach. */
async function findReachableMember(rawUsername: string) {
  const username = normalizeUsername(rawUsername);
  if (username === "") return null;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      penName: users.penName,
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt,
      anonBoxEnabled: users.anonBoxEnabled,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt), eq(users.isBanned, false)))
    .limit(1);

  const row = rows[0];
  return row?.username ? { ...row, username: row.username } : null;
}

/** Whether either side has blocked the other. */
export async function isBlockedEitherWay(
  a: string,
  b: string,
  executor: Executor = db,
): Promise<boolean> {
  const rows = await executor
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
    .limit(1);
  return rows.length > 0;
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* Handle                                                              */
/* ------------------------------------------------------------------ */

export const usernameSchema = z.strictObject({
  username: z.string().max(40, "Kullanıcı adı çok uzun."),
});

export async function getMemberSettings(
  actor: Actor,
): Promise<{ username: string | null; dmPolicy: DmPolicy; anonBoxEnabled: boolean }> {
  const rows = await db
    .select({ username: users.username, dmPolicy: users.dmPolicy, anonBoxEnabled: users.anonBoxEnabled })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  return {
    username: rows[0]?.username ?? null,
    dmPolicy: rows[0]?.dmPolicy ?? "following",
    anonBoxEnabled: rows[0]?.anonBoxEnabled ?? false,
  };
}

/** Picks or changes the handle. Returns the stored, normalised form. */
export async function setUsername(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<string> {
  assertMayPost(actor);

  const parsed = usernameSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Kullanıcı adı geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const username = normalizeUsername(parsed.data.username);
  const problem = usernameProblem(username);
  if (problem) throw badRequest(problem, { username: [problem] });

  const { username: current } = await getMemberSettings(actor);
  if (current === username) return username;

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt), ne(users.id, actor.id)))
    .limit(1);
  if (taken[0]) {
    throw conflict("Bu kullanıcı adı alınmış.", { username: ["Bu kullanıcı adı alınmış."] });
  }

  await db
    .update(users)
    .set({ username, updatedAt: new Date() })
    .where(eq(users.id, actor.id));

  // A handle is how moderation finds an account later, so its history is kept
  await writeAudit({
    actorId: actor.id,
    action: "social.username_set",
    entityType: "users",
    entityId: actor.id,
    before: { username: current },
    after: { username },
    ip: meta.ip,
  });

  return username;
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export type ProfileView = Member & {
  bio: string | null;
  /** Whether the profile shows the "anonymous message" link (D-092). */
  anonBoxEnabled: boolean;
  joinedAt: Date;
  followerCount: number;
  followingCount: number;
  isSelf: boolean;
  viewerFollows: boolean;
  followsViewer: boolean;
  viewerBlocked: boolean;
};

export async function getProfile(viewer: Actor, rawUsername: string): Promise<ProfileView> {
  const target = await findReachableMember(rawUsername);
  if (!target) throw notFound("Profil bulunamadı.");

  const isSelf = target.id === viewer.id;

  // Someone who blocked the viewer is simply not there for them; answering
  // "you are blocked" would tell them exactly what the block hides
  if (!isSelf && (await hasBlocked(target.id, viewer.id))) {
    throw notFound("Profil bulunamadı.");
  }

  const [[followers], [following], viewerFollows, followsViewer, viewerBlocked] =
    await Promise.all([
      db.select({ value: count() }).from(follows).where(eq(follows.followeeId, target.id)),
      db.select({ value: count() }).from(follows).where(eq(follows.followerId, target.id)),
      isSelf ? false : isFollowing(viewer.id, target.id),
      isSelf ? false : isFollowing(target.id, viewer.id),
      isSelf ? false : hasBlocked(viewer.id, target.id),
    ]);

  return {
    id: target.id,
    username: target.username,
    penName: target.penName,
    role: target.role,
    bio: target.bio,
    anonBoxEnabled: target.anonBoxEnabled,
    joinedAt: target.createdAt,
    followerCount: followers?.value ?? 0,
    followingCount: following?.value ?? 0,
    isSelf,
    viewerFollows,
    followsViewer,
    viewerBlocked,
  };
}

export type MemberListItem = Pick<Member, "username" | "penName" | "role">;

async function listGraph(
  viewer: Actor,
  rawUsername: string,
  direction: "followers" | "following",
): Promise<MemberListItem[]> {
  const profile = await getProfile(viewer, rawUsername);

  // Followers are the people pointing at the profile; following, the reverse
  const [anchor, other] =
    direction === "followers"
      ? [follows.followeeId, follows.followerId]
      : [follows.followerId, follows.followeeId];

  const rows = await db
    .select({ username: users.username, penName: users.penName, role: users.role })
    .from(follows)
    .innerJoin(users, eq(other, users.id))
    .where(and(eq(anchor, profile.id), isNull(users.deletedAt), eq(users.isBanned, false)))
    .orderBy(desc(follows.createdAt))
    .limit(500);

  return rows.filter((row): row is MemberListItem => row.username !== null);
}

export async function listFollowers(viewer: Actor, rawUsername: string) {
  return listGraph(viewer, rawUsername, "followers");
}

export async function listFollowing(viewer: Actor, rawUsername: string) {
  return listGraph(viewer, rawUsername, "following");
}

/* ------------------------------------------------------------------ */
/* Follow                                                              */
/* ------------------------------------------------------------------ */

/** Following twice is not an error: the button may simply have been pressed twice. */
export async function followMember(actor: Actor, rawUsername: string): Promise<void> {
  const me = await requireMember(actor);
  const target = await findReachableMember(rawUsername);
  if (!target) throw notFound("Profil bulunamadı.");
  if (target.id === me.id) throw badRequest("Kendinizi takip edemezsiniz.");
  if (await isBlockedEitherWay(me.id, target.id)) {
    throw forbidden("Bu hesapla etkileşim kurulamıyor.");
  }
  if (await isFollowing(me.id, target.id)) return;

  await db.transaction(async (tx) => {
    await tx.insert(follows).values({ followerId: me.id, followeeId: target.id });
    await notify(
      {
        userId: target.id,
        kind: "social.follow",
        title: `@${me.username} sizi takip etmeye başladı.`,
        href: `/social/u/${me.username}`,
      },
      tx,
    );
  });
}

export async function unfollowMember(actor: Actor, rawUsername: string): Promise<void> {
  assertMayPost(actor);
  const target = await findReachableMember(rawUsername);
  if (!target) throw notFound("Profil bulunamadı.");

  await db
    .delete(follows)
    .where(and(eq(follows.followerId, actor.id), eq(follows.followeeId, target.id)));
}

/* ------------------------------------------------------------------ */
/* Block                                                               */
/* ------------------------------------------------------------------ */

/**
 * Blocking also ends every follow between the two, in both directions: a
 * block that left the blocked person in the follower list would not be one.
 */
export async function blockMember(actor: Actor, rawUsername: string): Promise<void> {
  assertMayPost(actor);
  const target = await findReachableMember(rawUsername);
  if (!target) throw notFound("Profil bulunamadı.");
  if (target.id === actor.id) throw badRequest("Kendinizi engelleyemezsiniz.");

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, target.id)))
      .limit(1);
    if (!existing[0]) {
      await tx.insert(userBlocks).values({ blockerId: actor.id, blockedId: target.id });
    }

    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, actor.id), eq(follows.followeeId, target.id)),
          and(eq(follows.followerId, target.id), eq(follows.followeeId, actor.id)),
        ),
      );
  });
}

export async function unblockMember(actor: Actor, rawUsername: string): Promise<void> {
  assertMayPost(actor);
  const username = normalizeUsername(rawUsername);

  // Looked up without the ban filter: lifting a block on a banned account is fine
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
  if (!rows[0]) throw notFound("Profil bulunamadı.");

  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, rows[0].id)));
}

export async function listBlockedMembers(actor: Actor) {
  const rows = await db
    .select({ username: users.username, penName: users.penName, blockedAt: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(userBlocks.blockedId, users.id))
    .where(and(eq(userBlocks.blockerId, actor.id), isNull(users.deletedAt)))
    .orderBy(desc(userBlocks.createdAt));

  return rows.filter(
    (row): row is { username: string; penName: string | null; blockedAt: Date } =>
      row.username !== null,
  );
}

/* ------------------------------------------------------------------ */
/* Bookmarks                                                           */
/* ------------------------------------------------------------------ */

/**
 * The reading list is private, so it asks for no handle. Only a live,
 * published article can be saved; saving twice is not an error.
 */
export async function bookmarkArticle(actor: Actor, articleId: string): Promise<void> {
  assertMayPost(actor);
  if (!z.uuid().safeParse(articleId).success) throw badRequest("Yazı geçersiz.");

  const article = await db
    .select({ status: articles.status })
    .from(articles)
    .where(and(eq(articles.id, articleId), isNull(articles.deletedAt)))
    .limit(1);
  if (!article[0] || article[0].status !== "published") throw notFound("Yazı bulunamadı.");

  if (await isArticleBookmarked(actor, articleId)) return;
  await db.insert(bookmarks).values({ userId: actor.id, articleId });
}

export async function removeBookmark(actor: Actor, articleId: string): Promise<void> {
  if (!z.uuid().safeParse(articleId).success) throw badRequest("Yazı geçersiz.");
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.articleId, articleId)));
}

export async function isArticleBookmarked(actor: Actor, articleId: string): Promise<boolean> {
  const rows = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.articleId, articleId)))
    .limit(1);
  return rows.length > 0;
}

/** Saved articles that are still readable, newest save first. */
export async function listBookmarkedArticles(actor: Actor) {
  return db
    .select({
      articleId: articles.id,
      title: articles.title,
      slug: articles.slug,
      summary: articles.summary,
      publishedAt: articles.publishedAt,
      savedAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(articles, eq(bookmarks.articleId, articles.id))
    .where(
      and(
        eq(bookmarks.userId, actor.id),
        eq(articles.status, "published"),
        isNull(articles.deletedAt),
      ),
    )
    .orderBy(desc(bookmarks.createdAt));
}
