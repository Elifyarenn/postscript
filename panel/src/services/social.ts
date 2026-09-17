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
import { cache } from "react";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, notExists, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  auditLog,
  bookmarks,
  follows,
  userBlocks,
  users,
  type DmPolicy,
  type Role,
  posts,
} from "@/db/schema";
import { writeAudit, type Executor } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";
import { INTERESTS, isInterestId, MAX_INTERESTS } from "@/lib/interests";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { MAX_BIO_LENGTH, MAX_PEN_NAME_LENGTH } from "@/lib/profile-limits";
import { slugify } from "@/lib/slug";
import { formatDate } from "@/lib/utils";
import {
  nextUsernameChangeAt,
  normalizeUsername,
  USERNAME_CHANGE_DAYS,
  usernameProblem,
  rankUsernameMatches,
  USERNAME_SEARCH_MIN,
  usernameSearchPattern,
  usernameSearchTerm,
} from "@/lib/username";
import { assertMayPost } from "./community";
import { notify } from "./notifications";
import type { RequestMeta } from "./auth";

/** A member as the community may see them: never the legal name. */
export type Member = {
  id: string;
  username: string;
  /** The handle is the community name (D-166); the pen name is the magazine's and never shown here. */
  role: Role;
};

/**
 * The actor as a community member. Social actions start here: the account has
 * to be operational (D-072) and must have picked a handle.
 */
export async function requireMember(actor: Actor): Promise<Member> {
  assertMayPost(actor);

  const rows = await db
    .select({ id: users.id, username: users.username, role: users.role })
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
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt,
      anonBoxEnabled: users.anonBoxEnabled,
      avatarMediaId: users.avatarMediaId,
      headerMediaId: users.headerMediaId,
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

/** The address the media route serves a picture from. */
export function mediaUrl(mediaId: string | null): string | null {
  return mediaId ? `/api/media/${mediaId}` : null;
}

export type MemberSettings = {
  username: string | null;
  penName: string | null;
  dmPolicy: DmPolicy;
  /** Read ticks, both ways (D-188). */
  readReceipts: boolean;
  anonBoxEnabled: boolean;
  bio: string | null;
  interests: string[];
  avatarUrl: string | null;
  headerUrl: string | null;
};

export async function getMemberSettings(actor: Actor): Promise<MemberSettings> {
  return loadMemberSettings(actor.id);
}

/**
 * Keyed by id rather than by the actor, since every caller spreads a fresh
 * actor object. The site frame, its three unread counters and the page all
 * asked for the same row, four round trips per community page (D-171).
 */
const loadMemberSettings = cache(async (userId: string): Promise<MemberSettings> => {
  const rows = await db
    .select({
      username: users.username,
      penName: users.penName,
      dmPolicy: users.dmPolicy,
      readReceipts: users.readReceipts,
      anonBoxEnabled: users.anonBoxEnabled,
      bio: users.bio,
      interests: users.interests,
      avatarMediaId: users.avatarMediaId,
      headerMediaId: users.headerMediaId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    username: rows[0]?.username ?? null,
    penName: rows[0]?.penName ?? null,
    dmPolicy: rows[0]?.dmPolicy ?? "following",
    readReceipts: rows[0]?.readReceipts ?? true,
    anonBoxEnabled: rows[0]?.anonBoxEnabled ?? false,
    bio: rows[0]?.bio ?? null,
    interests: rows[0]?.interests ?? [],
    avatarUrl: mediaUrl(rows[0]?.avatarMediaId ?? null),
    headerUrl: mediaUrl(rows[0]?.headerMediaId ?? null),
  };
});

const penNameSchema = z.strictObject({
  penName: z
    .string()
    .trim()
    .max(MAX_PEN_NAME_LENGTH, `Mahlas en fazla ${MAX_PEN_NAME_LENGTH} karakter olabilir.`),
});

export const PEN_NAME_TAKEN = "Bu mahlas alınmış.";

/**
 * Why a pen name cannot be used, or null when it can. It has to turn into an
 * address, so it needs a letter or a digit, and that address belongs to one
 * member. Shared by the single-field save and the one-save edit (D-160).
 */
export async function penNameProblem(actorId: string, penName: string | null): Promise<string | null> {
  if (!penName) return null;

  const slug = slugify(penName);
  if (!slug) return "Mahlas en az bir harf ya da rakam içermeli.";

  // The slug is the author page's address, so two members cannot share one
  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.penNameSlug, slug), isNull(users.deletedAt), ne(users.id, actorId)))
    .limit(1);
  return taken[0] ? PEN_NAME_TAKEN : null;
}

/**
 * The pen name shown on the profile and on published work (D-144). Edited in
 * the community now, beside the handle and the bio; the account page keeps the
 * real name, the address and the password. An empty pen name clears it, and
 * the profile falls back to the handle.
 */
export async function setPenName(actor: Actor, rawInput: unknown): Promise<string | null> {
  assertMayPost(actor);

  const parsed = penNameSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Mahlas geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const penName = parsed.data.penName || null;
  const problem = await penNameProblem(actor.id, penName);
  if (problem) {
    // Taken is a clash with someone else's data, not a malformed request
    const details = { penName: [problem] };
    throw problem === PEN_NAME_TAKEN ? conflict(problem, details) : badRequest(problem, details);
  }
  const slug = penName ? slugify(penName) : null;

  await db
    .update(users)
    .set({ penName, penNameSlug: slug, updatedAt: new Date() })
    .where(eq(users.id, actor.id));

  return penName;
}

/**
 * The last time the member replaced a handle they already had, within the
 * change window. Read from the audit trail, which records every handle change
 * with its before and after and is never deleted, so no second record of the
 * same fact is kept. The first pick (before: null) does not count.
 */
async function lastUsernameChangeAt(userId: string): Promise<Date | null> {
  const since = new Date(Date.now() - USERNAME_CHANGE_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ before: auditLog.before, createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(eq(auditLog.action, "social.username_set"), eq(auditLog.entityId, userId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(20);
  // Filtered here rather than in SQL: a JSON path in the query is the driver-sensitive kind (D-078)
  const change = rows.find(
    (row) =>
      row.createdAt >= since &&
      typeof row.before === "object" &&
      row.before !== null &&
      (row.before as { username?: unknown }).username != null,
  );
  return change?.createdAt ?? null;
}

/** When the member may change the handle again; null when they may now (D-166). */
export async function usernameChangeAvailableAt(actor: Actor): Promise<Date | null> {
  return nextUsernameChangeAt(await lastUsernameChangeAt(actor.id));
}

/**
 * Picks or changes the handle. Returns the stored, normalised form. A handle
 * already held can be replaced once every 30 days (D-166): it is how members
 * find each other and how moderation traces an account, so it must not shift
 * from week to week.
 */
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

  if (current !== null) {
    const availableAt = await usernameChangeAvailableAt(actor);
    if (availableAt) {
      const message = `Kullanıcı adınızı ${USERNAME_CHANGE_DAYS} günde bir değiştirebilirsiniz. Bir sonraki değişiklik: ${formatDate(availableAt)}.`;
      throw conflict(message, { username: [message] });
    }
  }

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

const bioSchema = z.strictObject({
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Biyografi en fazla ${MAX_BIO_LENGTH} karakter olabilir.`),
});

const interestsSchema = z.strictObject({
  interests: z
    .array(z.string().trim())
    .max(MAX_INTERESTS, `En fazla ${MAX_INTERESTS} ilgi alanı seçebilirsiniz.`),
});

/**
 * The interest chips on the community settings (D-149). The member picks from
 * a fixed list, so anything outside it is refused rather than quietly dropped;
 * choosing nothing clears the row.
 */
export async function setInterests(actor: Actor, rawInput: unknown): Promise<string[]> {
  assertMayPost(actor);

  const parsed = interestsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("İlgi alanları geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const chosen = [...new Set(parsed.data.interests)];
  const unknown = chosen.filter((id) => !isInterestId(id));
  if (unknown.length > 0) {
    throw badRequest("Listede olmayan bir ilgi alanı seçildi.", {
      interests: ["Listede olmayan bir ilgi alanı seçildi."],
    });
  }

  // The stored order follows the list, so the chips never shuffle between visits
  const ordered = INTERESTS.map((interest) => interest.id).filter((id) => chosen.includes(id));
  await db
    .update(users)
    .set({ interests: ordered.length > 0 ? ordered : null, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
  return ordered;
}

/**
 * The short bio on the member's community profile (D-136), edited from the
 * community settings. It is saved on its own: the account form also asks for
 * the real name, which a member changing a sentence about themselves should
 * not have to send again. An empty bio clears it.
 */
export async function setBio(actor: Actor, rawInput: unknown): Promise<string | null> {
  assertMayPost(actor);

  const parsed = bioSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Biyografi geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const bio = parsed.data.bio || null;
  await db.update(users).set({ bio, updatedAt: new Date() }).where(eq(users.id, actor.id));
  return bio;
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

export type ProfileView = Member & {
  bio: string | null;
  /** Whether the profile shows the "anonymous message" link (D-092). */
  anonBoxEnabled: boolean;
  /** Where to fetch the member's pictures, or null when they have none (D-141). */
  avatarUrl: string | null;
  headerUrl: string | null;
  joinedAt: Date;
  followerCount: number;
  followingCount: number;
  /** Posts the member shared themselves; replies and removed posts are not counted (D-116). */
  postCount: number;
  isSelf: boolean;
  viewerFollows: boolean;
  followsViewer: boolean;
  viewerBlocked: boolean;
};

export async function getProfile(viewer: Actor, rawUsername: string): Promise<ProfileView> {
  return loadProfile(viewer.id, rawUsername);
}

/**
 * A profile page asks for the same profile four times: the header, the paged
 * tab, the featured post and the side column's comments (D-172). Memoised by
 * viewer and handle, so the page pays for it once.
 */
const loadProfile = cache(async (viewerId: string, rawUsername: string): Promise<ProfileView> => {
  const target = await findReachableMember(rawUsername);
  if (!target) throw notFound("Profil bulunamadı.");

  const isSelf = target.id === viewerId;

  // Someone who blocked the viewer is simply not there for them; answering
  // "you are blocked" would tell them exactly what the block hides
  if (!isSelf && (await hasBlocked(target.id, viewerId))) {
    throw notFound("Profil bulunamadı.");
  }

  const [[followers], [following], [shared], viewerFollows, followsViewer, viewerBlocked] =
    await Promise.all([
      db.select({ value: count() }).from(follows).where(eq(follows.followeeId, target.id)),
      db.select({ value: count() }).from(follows).where(eq(follows.followerId, target.id)),
      db
        .select({ value: count() })
        .from(posts)
        .where(and(eq(posts.authorId, target.id), isNull(posts.deletedAt), isNull(posts.replyToId))),
      isSelf ? false : isFollowing(viewerId, target.id),
      isSelf ? false : isFollowing(target.id, viewerId),
      isSelf ? false : hasBlocked(viewerId, target.id),
    ]);

  return {
    id: target.id,
    username: target.username,
    role: target.role,
    bio: target.bio,
    anonBoxEnabled: target.anonBoxEnabled,
    avatarUrl: mediaUrl(target.avatarMediaId),
    headerUrl: mediaUrl(target.headerMediaId),
    joinedAt: target.createdAt,
    followerCount: followers?.value ?? 0,
    followingCount: following?.value ?? 0,
    postCount: shared?.value ?? 0,
    isSelf,
    viewerFollows,
    followsViewer,
    viewerBlocked,
  };
});

export type MemberListItem = Pick<Member, "username" | "role">;

/**
 * Members whose handle contains what was typed (D-186). Only the handle is
 * searched: the legal name never shows in the community, and matching the pen
 * name would tie the magazine byline to a community account (D-163, D-166).
 * Someone on either side of a block, a banned or deleted account and an
 * account without a handle are not found.
 */
export async function searchMembers(actor: Actor, rawQuery: string, limit = 20): Promise<MemberListItem[]> {
  assertMayPost(actor);
  const term = usernameSearchTerm(rawQuery);
  if (term.length < USERNAME_SEARCH_MIN) return [];

  const blockedEitherWay = db
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, actor.id), eq(userBlocks.blockedId, users.id)),
        and(eq(userBlocks.blockerId, users.id), eq(userBlocks.blockedId, actor.id)),
      ),
    );

  const rows = await db
    .select({ username: users.username, role: users.role })
    .from(users)
    .where(
      and(
        ilike(users.username, usernameSearchPattern(term)),
        isNull(users.deletedAt),
        eq(users.isBanned, false),
        ne(users.id, actor.id),
        notExists(blockedEitherWay),
      ),
    )
    .limit(100);

  const found = rows.filter((row): row is MemberListItem => row.username !== null);
  return rankUsernameMatches(found, term).slice(0, limit);
}

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
    .select({ username: users.username, role: users.role })
    .from(follows)
    .innerJoin(users, eq(other, users.id))
    .where(and(eq(anchor, profile.id), isNull(users.deletedAt), eq(users.isBanned, false)))
    .orderBy(desc(follows.createdAt))
    .limit(500);

  return rows.filter((row): row is MemberListItem => row.username !== null);
}

/**
 * The members the viewer and the other follow each other (D-143). The messages
 * column offers them, because under the default preference a mutual follow is
 * exactly who may be written to. A block on either side removes the pair, and
 * somebody without a handle is not in the community yet.
 */
export async function listMutualFollows(actor: Actor, limit = 20): Promise<MemberListItem[]> {
  const me = await requireMember(actor);

  const theyFollowMe = db
    .select({ id: follows.followerId })
    .from(follows)
    .where(eq(follows.followeeId, me.id));

  const rows = await db
    .select({ username: users.username, role: users.role })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(
      and(
        eq(follows.followerId, me.id),
        inArray(follows.followeeId, theyFollowMe),
        isNull(users.deletedAt),
        eq(users.isBanned, false),
        isNotNull(users.username),
        notExists(
          db
            .select({ id: userBlocks.id })
            .from(userBlocks)
            .where(
              or(
                and(eq(userBlocks.blockerId, me.id), eq(userBlocks.blockedId, users.id)),
                and(eq(userBlocks.blockerId, users.id), eq(userBlocks.blockedId, me.id)),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(users.username))
    .limit(limit);

  return rows.flatMap((row) =>
    row.username ? [{ username: row.username, role: row.role }] : [],
  );
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
    .select({ username: users.username, blockedAt: userBlocks.createdAt })
    .from(userBlocks)
    .innerJoin(users, eq(userBlocks.blockedId, users.id))
    .where(and(eq(userBlocks.blockerId, actor.id), isNull(users.deletedAt)))
    .orderBy(desc(userBlocks.createdAt));

  return rows.filter(
    (row): row is { username: string; blockedAt: Date } =>
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
