/**
 * Member posts (D-090): posting, replies, likes, reposts, saving, and the
 * timelines built from them.
 *
 * A post is user content: it is masked against the blacklist, it leaves a
 * 5651 traffic record in the same transaction (D-088), and it can be reported.
 * Blocks (D-089) cut both ways here too: neither side sees, answers, likes or
 * reposts the other's posts.
 */
import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  bookmarks,
  communities,
  follows,
  postLikes,
  postReposts,
  posts,
  userBlocks,
  users,
  type Role,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound, rateLimited } from "@/lib/errors";
import { maskBannedWords } from "@/lib/moderation";
import { mergeTimeline, rankExplorePosts, rankSuggestions } from "@/lib/ranking";
import { recordTraffic, trafficCutoff } from "@/lib/traffic";
import { activeBannedWords, assertMayPost } from "./community";
import { assertCanPostInCommunity } from "./communities";
import { notify } from "./notifications";
import {
  getProfile,
  isBlockedEitherWay,
  requireMember,
  type MemberListItem,
} from "./social";
import type { RequestMeta } from "./auth";

export const MAX_POST_LENGTH = 1000;

/** A burst guard, not a quota: nobody types five posts a minute by hand. */
export const POSTS_PER_MINUTE = 5;

const EXPLORE_WINDOW_DAYS = 30;

export const postSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, "Gönderi boş olamaz.")
    .max(MAX_POST_LENGTH, `Gönderi en çok ${MAX_POST_LENGTH} karakter olabilir.`),
  replyToId: z.uuid().optional().nullable(),
  communityId: z.uuid().optional().nullable(),
});

export type PostAuthor = { username: string; penName: string | null; role: Role };

export type PostView = {
  id: string;
  body: string;
  createdAt: Date;
  author: PostAuthor;
  /** The answered post; its author is null when that post is no longer visible. */
  replyTo: { id: string; author: PostAuthor | null } | null;
  /** The community it was shared in (D-093). */
  community: { slug: string; name: string } | null;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  viewerLiked: boolean;
  viewerReposted: boolean;
  viewerBookmarked: boolean;
  isOwn: boolean;
  /** Set when the post reached this list through someone's repost. */
  repostedBy: PostAuthor | null;
};

type Entry = { postId: string; at: Date; repostedBy: PostAuthor | null };

/** An author the community may still see: not deleted, not banned, with a handle. */
const visibleAuthor = [isNull(users.deletedAt), eq(users.isBanned, false), isNotNull(users.username)];

/** Everyone on the other side of a block, whichever side placed it. */
async function blockedIdsFor(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(or(eq(userBlocks.blockerId, viewerId), eq(userBlocks.blockedId, viewerId)));
  return rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId));
}

function countMap(rows: { postId: string | null; value: number }[]): Map<string, number> {
  return new Map(
    rows.filter((row): row is { postId: string; value: number } => row.postId !== null)
      .map((row) => [row.postId, row.value]),
  );
}

/**
 * Turns timeline entries into what the screen shows, in the entries' order.
 * Anything no longer visible to the viewer (deleted, a banned or blocked
 * author) silently drops out.
 */
async function hydrate(
  viewerId: string,
  entries: readonly Entry[],
  blocked: readonly string[],
): Promise<PostView[]> {
  const ids = [...new Set(entries.map((entry) => entry.postId))];
  if (ids.length === 0) return [];

  const notBlocked: SQL[] = blocked.length > 0 ? [notInArray(posts.authorId, [...blocked])] : [];

  const rows = await db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      replyToId: posts.replyToId,
      communityId: posts.communityId,
      communitySlug: communities.slug,
      communityName: communities.name,
      username: users.username,
      penName: users.penName,
      role: users.role,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(communities, eq(posts.communityId, communities.id))
    .where(and(inArray(posts.id, ids), isNull(posts.deletedAt), ...visibleAuthor, ...notBlocked));

  if (rows.length === 0) return [];

  const visibleIds = rows.map((row) => row.id);
  const parentIds = [
    ...new Set(rows.map((row) => row.replyToId).filter((id): id is string => id !== null)),
  ];

  const [likes, replies, reposts, liked, reposted, saved, parents] = await Promise.all([
    db
      .select({ postId: postLikes.postId, value: count() })
      .from(postLikes)
      .where(inArray(postLikes.postId, visibleIds))
      .groupBy(postLikes.postId),
    db
      .select({ postId: posts.replyToId, value: count() })
      .from(posts)
      .where(and(inArray(posts.replyToId, visibleIds), isNull(posts.deletedAt)))
      .groupBy(posts.replyToId),
    db
      .select({ postId: postReposts.postId, value: count() })
      .from(postReposts)
      .where(inArray(postReposts.postId, visibleIds))
      .groupBy(postReposts.postId),
    db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(and(eq(postLikes.userId, viewerId), inArray(postLikes.postId, visibleIds))),
    db
      .select({ postId: postReposts.postId })
      .from(postReposts)
      .where(and(eq(postReposts.userId, viewerId), inArray(postReposts.postId, visibleIds))),
    db
      .select({ postId: bookmarks.postId })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, viewerId), inArray(bookmarks.postId, visibleIds))),
    parentIds.length === 0
      ? Promise.resolve([] as { id: string; username: string | null; penName: string | null; role: Role }[])
      : db
          .select({ id: posts.id, username: users.username, penName: users.penName, role: users.role })
          .from(posts)
          .innerJoin(users, eq(posts.authorId, users.id))
          .where(and(inArray(posts.id, parentIds), isNull(posts.deletedAt), ...visibleAuthor, ...notBlocked)),
  ]);

  const byId = new Map(rows.map((row) => [row.id, row]));
  const parentById = new Map(parents.map((parent) => [parent.id, parent]));
  const likeCounts = countMap(likes);
  const replyCounts = countMap(replies);
  const repostCounts = countMap(reposts);
  const likedSet = new Set(liked.map((row) => row.postId));
  const repostedSet = new Set(reposted.map((row) => row.postId));
  const savedSet = new Set(saved.map((row) => row.postId));

  const views: PostView[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const row = byId.get(entry.postId);
    if (!row || !row.username || seen.has(row.id)) continue;
    seen.add(row.id);

    const parent = row.replyToId ? parentById.get(row.replyToId) : undefined;
    views.push({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      author: { username: row.username, penName: row.penName, role: row.role },
      replyTo: row.replyToId
        ? {
            id: row.replyToId,
            author: parent?.username
              ? { username: parent.username, penName: parent.penName, role: parent.role }
              : null,
          }
        : null,
      community:
        row.communitySlug && row.communityName
          ? { slug: row.communitySlug, name: row.communityName }
          : null,
      likeCount: likeCounts.get(row.id) ?? 0,
      replyCount: replyCounts.get(row.id) ?? 0,
      repostCount: repostCounts.get(row.id) ?? 0,
      viewerLiked: likedSet.has(row.id),
      viewerReposted: repostedSet.has(row.id),
      viewerBookmarked: savedSet.has(row.id),
      isOwn: row.authorId === viewerId,
      repostedBy: entry.repostedBy,
    });
  }
  return views;
}

/** A post the actor may act on; hidden and blocked posts answer 404 alike. */
async function reachablePost(viewerId: string, postId: string): Promise<{ id: string; authorId: string }> {
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");

  const rows = await db
    .select({ id: posts.id, authorId: posts.authorId })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt), ...visibleAuthor))
    .limit(1);

  const row = rows[0];
  if (!row?.authorId) throw notFound("Gönderi bulunamadı.");
  if (row.authorId !== viewerId && (await isBlockedEitherWay(viewerId, row.authorId))) {
    throw notFound("Gönderi bulunamadı.");
  }
  return { id: row.id, authorId: row.authorId };
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export async function createPost(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string }> {
  const me = await requireMember(actor);

  const parsed = postSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Gönderi geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const [recent] = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.authorId, me.id), gte(posts.createdAt, new Date(Date.now() - 60_000))));
  if ((recent?.value ?? 0) >= POSTS_PER_MINUTE) {
    throw rateLimited("Çok hızlı paylaşım yapıyorsunuz. Biraz bekleyip yeniden deneyin.");
  }

  let parent: { id: string; authorId: string } | null = null;
  if (parsed.data.replyToId) {
    parent = await reachablePost(me.id, parsed.data.replyToId).catch((error: unknown) => {
      throw error instanceof Error && "status" in error && error.status === 404
        ? notFound("Yanıtlanan gönderi bulunamadı.")
        : error;
    });
  }

  const communityId = parsed.data.communityId ?? null;
  if (communityId) await assertCanPostInCommunity(me.id, communityId);

  const body = maskBannedWords(parsed.data.body, await activeBannedWords());

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(posts)
      .values({ authorId: me.id, body, replyToId: parent?.id ?? null, communityId })
      .returning({ id: posts.id });

    await recordTraffic(
      {
        userId: me.id,
        action: parent ? "social.reply_created" : "social.post_created",
        entityType: "posts",
        entityId: row!.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      tx,
    );

    if (parent && parent.authorId !== me.id) {
      await notify(
        {
          userId: parent.authorId,
          kind: "social.reply",
          title: `@${me.username} gönderinize yanıt verdi.`,
          href: `/social/posts/${row!.id}`,
        },
        tx,
      );
    }

    return { id: row!.id };
  });
}

/** The author takes their own post down; it is kept a year, then pruned. */
export async function deleteOwnPost(actor: Actor, postId: string): Promise<void> {
  assertMayPost(actor);
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");

  const now = new Date();
  const updated = await db
    .update(posts)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(posts.id, postId), eq(posts.authorId, actor.id), isNull(posts.deletedAt)))
    .returning({ id: posts.id });

  if (updated.length === 0) throw notFound("Gönderi bulunamadı.");
}

/* ------------------------------------------------------------------ */
/* Likes, reposts, saves                                               */
/* ------------------------------------------------------------------ */

export async function likePost(actor: Actor, postId: string): Promise<void> {
  const me = await requireMember(actor);
  const post = await reachablePost(me.id, postId);

  const existing = await db
    .select({ id: postLikes.id })
    .from(postLikes)
    .where(and(eq(postLikes.userId, me.id), eq(postLikes.postId, post.id)))
    .limit(1);
  if (existing[0]) return;

  await db.transaction(async (tx) => {
    await tx.insert(postLikes).values({ userId: me.id, postId: post.id });
    if (post.authorId !== me.id) {
      await notify(
        {
          userId: post.authorId,
          kind: "social.like",
          title: `@${me.username} gönderinizi beğendi.`,
          href: `/social/posts/${post.id}`,
        },
        tx,
      );
    }
  });
}

export async function unlikePost(actor: Actor, postId: string): Promise<void> {
  assertMayPost(actor);
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");
  await db.delete(postLikes).where(and(eq(postLikes.userId, actor.id), eq(postLikes.postId, postId)));
}

export async function repostPost(actor: Actor, postId: string): Promise<void> {
  const me = await requireMember(actor);
  const post = await reachablePost(me.id, postId);

  const existing = await db
    .select({ id: postReposts.id })
    .from(postReposts)
    .where(and(eq(postReposts.userId, me.id), eq(postReposts.postId, post.id)))
    .limit(1);
  if (existing[0]) return;

  await db.transaction(async (tx) => {
    await tx.insert(postReposts).values({ userId: me.id, postId: post.id });
    if (post.authorId !== me.id) {
      await notify(
        {
          userId: post.authorId,
          kind: "social.repost",
          title: `@${me.username} gönderinizi yeniden paylaştı.`,
          href: `/social/posts/${post.id}`,
        },
        tx,
      );
    }
  });
}

export async function unrepostPost(actor: Actor, postId: string): Promise<void> {
  assertMayPost(actor);
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");
  await db
    .delete(postReposts)
    .where(and(eq(postReposts.userId, actor.id), eq(postReposts.postId, postId)));
}

/** Saving is private, so it asks for no handle (like saving an article). */
export async function bookmarkPost(actor: Actor, postId: string): Promise<void> {
  assertMayPost(actor);
  const post = await reachablePost(actor.id, postId);

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.postId, post.id)))
    .limit(1);
  if (existing[0]) return;

  await db.insert(bookmarks).values({ userId: actor.id, postId: post.id });
}

export async function removePostBookmark(actor: Actor, postId: string): Promise<void> {
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.postId, postId)));
}

/* ------------------------------------------------------------------ */
/* Timelines                                                           */
/* ------------------------------------------------------------------ */

/** The member's own posts and those of the people they follow, reposts included. */
export async function listHomeFeed(actor: Actor, limit = 50): Promise<PostView[]> {
  const me = await requireMember(actor);
  const blocked = await blockedIdsFor(me.id);

  const followed = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, me.id));
  const authorIds = [me.id, ...followed.map((row) => row.id)];

  const [own, reposts] = await Promise.all([
    db
      .select({ postId: posts.id, at: posts.createdAt })
      .from(posts)
      .where(and(inArray(posts.authorId, authorIds), isNull(posts.replyToId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(limit),
    db
      .select({
        postId: postReposts.postId,
        at: postReposts.createdAt,
        username: users.username,
        penName: users.penName,
        role: users.role,
      })
      .from(postReposts)
      .innerJoin(users, eq(postReposts.userId, users.id))
      .where(and(inArray(postReposts.userId, authorIds), ...visibleAuthor))
      .orderBy(desc(postReposts.createdAt))
      .limit(limit),
  ]);

  const entries = mergeTimeline<Entry>(
    [
      ...own.map((row) => ({ ...row, repostedBy: null })),
      ...reposts.map((row) => ({
        postId: row.postId,
        at: row.at,
        repostedBy: { username: row.username!, penName: row.penName, role: row.role },
      })),
    ],
    limit,
  );

  return hydrate(me.id, entries, blocked);
}

/** Explore: the last thirty days' top-level posts, ranked by a plain rule. */
export async function listExplorePosts(actor: Actor, limit = 30): Promise<PostView[]> {
  assertMayPost(actor);
  const blocked = await blockedIdsFor(actor.id);
  const since = new Date(Date.now() - EXPLORE_WINDOW_DAYS * 86_400_000);

  const recent = await db
    .select({ postId: posts.id, at: posts.createdAt })
    .from(posts)
    .where(and(isNull(posts.replyToId), isNull(posts.deletedAt), gte(posts.createdAt, since)))
    .orderBy(desc(posts.createdAt))
    .limit(200);

  const views = await hydrate(
    actor.id,
    recent.map((row) => ({ ...row, repostedBy: null })),
    blocked,
  );
  return rankExplorePosts(views).slice(0, limit);
}

/** Friends of friends first; when that runs short, the most followed members. */
export async function suggestMembers(actor: Actor, limit = 5): Promise<MemberListItem[]> {
  assertMayPost(actor);
  const blocked = await blockedIdsFor(actor.id);

  const followed = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, actor.id));
  const followedIds = followed.map((row) => row.id);
  const exclude = new Set([actor.id, ...followedIds, ...blocked]);

  const secondDegree =
    followedIds.length === 0
      ? []
      : await db
          .select({ id: follows.followeeId })
          .from(follows)
          .where(inArray(follows.followerId, followedIds));

  const candidates = rankSuggestions(
    secondDegree.map((row) => row.id),
    exclude,
  );

  if (candidates.length < limit) {
    const popular = await db
      .select({ id: follows.followeeId, value: count() })
      .from(follows)
      .groupBy(follows.followeeId)
      .orderBy(desc(count()))
      .limit(50);
    for (const row of popular) {
      if (!exclude.has(row.id) && !candidates.includes(row.id)) candidates.push(row.id);
    }
  }

  const shortlist = candidates.slice(0, limit * 3);
  if (shortlist.length === 0) return [];

  const rows = await db
    .select({ id: users.id, username: users.username, penName: users.penName, role: users.role })
    .from(users)
    .where(and(inArray(users.id, shortlist), ...visibleAuthor));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return shortlist
    .map((id) => byId.get(id))
    .filter((row): row is { id: string; username: string; penName: string | null; role: Role } =>
      Boolean(row?.username),
    )
    .slice(0, limit)
    .map(({ username, penName, role }) => ({ username, penName, role }));
}

export type ProfileTab = "posts" | "replies" | "favorites";

/**
 * A profile's tabs. Likes are shown to the profile owner alone: a list of what
 * someone liked says more about them than they chose to publish (D-090).
 */
export async function listProfilePosts(
  actor: Actor,
  rawUsername: string,
  tab: ProfileTab,
  limit = 50,
): Promise<PostView[]> {
  const profile = await getProfile(actor, rawUsername);
  const blocked = await blockedIdsFor(actor.id);

  if (tab === "favorites") {
    if (!profile.isSelf) throw forbidden("Beğeniler yalnızca profil sahibine görünür.");
    const likes = await db
      .select({ postId: postLikes.postId, at: postLikes.createdAt })
      .from(postLikes)
      .where(eq(postLikes.userId, profile.id))
      .orderBy(desc(postLikes.createdAt))
      .limit(limit);
    return hydrate(actor.id, likes.map((row) => ({ ...row, repostedBy: null })), blocked);
  }

  if (tab === "replies") {
    const replies = await db
      .select({ postId: posts.id, at: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.authorId, profile.id), isNotNull(posts.replyToId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
    return hydrate(actor.id, replies.map((row) => ({ ...row, repostedBy: null })), blocked);
  }

  const author: PostAuthor = { username: profile.username, penName: profile.penName, role: profile.role };
  const [own, reposts] = await Promise.all([
    db
      .select({ postId: posts.id, at: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.authorId, profile.id), isNull(posts.replyToId), isNull(posts.deletedAt)))
      .orderBy(desc(posts.createdAt))
      .limit(limit),
    db
      .select({ postId: postReposts.postId, at: postReposts.createdAt })
      .from(postReposts)
      .where(eq(postReposts.userId, profile.id))
      .orderBy(desc(postReposts.createdAt))
      .limit(limit),
  ]);

  const entries = mergeTimeline<Entry>(
    [
      ...own.map((row) => ({ ...row, repostedBy: null })),
      ...reposts.map((row) => ({ ...row, repostedBy: author })),
    ],
    limit,
  );
  return hydrate(actor.id, entries, blocked);
}

/** A post with the post it answers and its replies, oldest reply first. */
export async function getPostThread(actor: Actor, postId: string) {
  assertMayPost(actor);
  if (!z.uuid().safeParse(postId).success) throw notFound("Gönderi bulunamadı.");
  const blocked = await blockedIdsFor(actor.id);

  const [post] = await hydrate(actor.id, [{ postId, at: new Date(), repostedBy: null }], blocked);
  if (!post) throw notFound("Gönderi bulunamadı.");

  const parent = post.replyTo
    ? ((await hydrate(actor.id, [{ postId: post.replyTo.id, at: new Date(), repostedBy: null }], blocked))[0] ?? null)
    : null;

  const replyRows = await db
    .select({ postId: posts.id, at: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.replyToId, post.id), isNull(posts.deletedAt)))
    .orderBy(asc(posts.createdAt))
    .limit(200);
  const replies = await hydrate(
    actor.id,
    replyRows.map((row) => ({ ...row, repostedBy: null })),
    blocked,
  );

  return { post, parent, replies };
}

/** A community's top-level posts, newest first. */
export async function listCommunityPosts(
  actor: Actor,
  communityId: string,
  limit = 50,
): Promise<PostView[]> {
  assertMayPost(actor);
  const blocked = await blockedIdsFor(actor.id);

  const rows = await db
    .select({ postId: posts.id, at: posts.createdAt })
    .from(posts)
    .where(and(eq(posts.communityId, communityId), isNull(posts.replyToId), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  return hydrate(actor.id, rows.map((row) => ({ ...row, repostedBy: null })), blocked);
}

export async function listBookmarkedPosts(actor: Actor): Promise<PostView[]> {
  assertMayPost(actor);
  const blocked = await blockedIdsFor(actor.id);

  const saved = await db
    .select({ postId: bookmarks.postId, at: bookmarks.createdAt })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, actor.id), isNotNull(bookmarks.postId)))
    .orderBy(desc(bookmarks.createdAt));

  return hydrate(
    actor.id,
    saved.map((row) => ({ postId: row.postId!, at: row.at, repostedBy: null })),
    blocked,
  );
}

/* ------------------------------------------------------------------ */
/* Moderation                                                          */
/* ------------------------------------------------------------------ */

export async function removePostAsModerator(
  actor: Actor,
  postId: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();
  if (!z.uuid().safeParse(postId).success) throw badRequest("Gönderi geçersiz.");

  const now = new Date();
  const updated = await db
    .update(posts)
    .set({ deletedAt: now, removedBy: actor.id, updatedAt: now })
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .returning({ id: posts.id });
  if (updated.length === 0) throw notFound("Gönderi bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "social.post_removed",
    entityType: "posts",
    entityId: postId,
    ip: meta.ip,
  });
}

/** The newest posts, removed ones included, for the moderation screen. */
export async function listRecentPostsForAdmin(actor: Actor, limit = 150) {
  if (!canModerateCommunity(actor)) throw forbidden();

  return db
    .select({
      id: posts.id,
      body: posts.body,
      createdAt: posts.createdAt,
      deletedAt: posts.deletedAt,
      removedBy: posts.removedBy,
      authorName: users.displayName,
      authorUsername: users.username,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

/** Deleted or removed posts past their year (KVKK notice, D-090). */
export async function pruneDeletedPosts(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(posts)
    .where(and(isNotNull(posts.deletedAt), lt(posts.deletedAt, trafficCutoff(now))))
    .returning({ id: posts.id });
  return removed.length;
}
