/**
 * The social graph (D-089): handles, profiles, follows, blocks, bookmarks and
 * what account deletion leaves behind.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, auditLog, bookmarks, follows, notifications, userBlocks, users } from "@/db/schema";
import {
  blockMember,
  bookmarkArticle,
  followMember,
  getProfile,
  isArticleBookmarked,
  listBookmarkedArticles,
  listFollowers,
  removeBookmark,
  setUsername,
  unblockMember,
  usernameChangeAvailableAt,
  unfollowMember,
} from "@/services/social";
import { addCommunityComment, listCommentsForArticle } from "@/services/community";
import { anonymiseUser } from "@/services/users";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

/** A verified account that already picked a handle. */
async function member(username: string, overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  await setUsername(actorOf(user), { username }, noMeta);
  return reloadUser(user.id);
}

let slugCounter = 0;

async function article(status: "published" | "draft") {
  slugCounter += 1;
  const [row] = await db
    .insert(articles)
    .values({
      title: "Kaydedilecek",
      slug: `kaydedilecek-${slugCounter}`,
      bodyMarkdown: "gövde",
      status,
      publishedAt: status === "published" ? new Date() : null,
    })
    .returning();
  return row!;
}

describe("handles", () => {
  it("stores the normalised handle", async () => {
    const user = await createUser();
    const stored = await setUsername(actorOf(user), { username: " @Lunae " }, noMeta);
    expect(stored).toBe("lunae");
    expect((await reloadUser(user.id)).username).toBe("lunae");
  });

  it("refuses a reserved, malformed or taken handle", async () => {
    await member("lunae");
    const other = await createUser();

    expect((await captureError(setUsername(actorOf(other), { username: "admin" }, noMeta))).status).toBe(400);
    expect((await captureError(setUsername(actorOf(other), { username: "a b" }, noMeta))).status).toBe(400);
    expect((await captureError(setUsername(actorOf(other), { username: "LUNAE" }, noMeta))).status).toBe(409);
  });

  it("lets a held handle change once every 30 days; the first pick is free (D-166)", async () => {
    const user = await createUser();
    await setUsername(actorOf(user), { username: "lunae" }, noMeta);
    // Replacing the first pick is allowed straight away
    expect(await setUsername(actorOf(user), { username: "lunae_iki" }, noMeta)).toBe("lunae_iki");

    const error = await captureError(setUsername(actorOf(user), { username: "lunae_uc" }, noMeta));
    expect(error.status).toBe(409);
    expect(error.details?.username?.[0]).toMatch(/30 günde bir/);
    expect((await reloadUser(user.id)).username).toBe("lunae_iki");
    expect(await usernameChangeAvailableAt(actorOf(user))).not.toBeNull();

    // Saving the same handle again is not a change and is never refused
    expect(await setUsername(actorOf(user), { username: "lunae_iki" }, noMeta)).toBe("lunae_iki");
  });

  it("opens the handle again 30 days after the last change", async () => {
    const user = await createUser();
    await setUsername(actorOf(user), { username: "velvet" }, noMeta);
    // A change recorded 31 days ago, the way the service records one; the first
    // pick above is in the trail too and does not count
    await db.insert(auditLog).values({
      actorId: user.id,
      action: "social.username_set",
      entityType: "users",
      entityId: user.id,
      before: { username: "eski_velvet" },
      after: { username: "velvet" },
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    expect(await usernameChangeAvailableAt(actorOf(user))).toBeNull();
    expect(await setUsername(actorOf(user), { username: "velvet_yeni" }, noMeta)).toBe("velvet_yeni");
  });

  it("refuses an unverified or banned account", async () => {
    const unverified = await createUser({ emailVerified: false });
    const banned = await createUser({ isBanned: true });

    expect((await captureError(setUsername(actorOf(unverified), { username: "yeni" }, noMeta))).status).toBe(403);
    expect((await captureError(setUsername(actorOf(banned), { username: "yasakli" }, noMeta))).status).toBe(403);
  });

  it("shows the handle on comments instead of the display name", async () => {
    const reader = await member("okur_kerem", { displayName: "Kerem Gerçekad" });
    const published = await article("published");

    await addCommunityComment(actorOf(reader), { articleId: published.id, body: "güzel" }, noMeta);
    const [comment] = await listCommentsForArticle(published.id);
    expect(comment!.authorName).toBe("@okur_kerem");
  });
});

describe("profiles and follows", () => {
  it("asks for a handle before following", async () => {
    await member("lunae");
    const noHandle = await createUser();

    const error = await captureError(followMember(actorOf(noHandle), "lunae"));
    expect(error.status).toBe(409);
  });

  it("follows once, notifies the followee and counts both sides", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");

    await followMember(actorOf(velvet), "lunae");
    await followMember(actorOf(velvet), "lunae"); // pressed twice

    const profile = await getProfile(actorOf(velvet), "lunae");
    expect(profile.followerCount).toBe(1);
    expect(profile.postCount).toBe(0);
    expect(profile.viewerFollows).toBe(true);
    expect(profile.isSelf).toBe(false);

    const rows = await db.select().from(notifications).where(eq(notifications.userId, lunae.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.href).toBe("/social/u/velvet");

    const followers = await listFollowers(actorOf(lunae), "lunae");
    expect(followers.map((item) => item.username)).toEqual(["velvet"]);
    // The display name never reaches the list
    expect(JSON.stringify(followers)).not.toContain(velvet.displayName);

    await unfollowMember(actorOf(velvet), "lunae");
    expect((await getProfile(actorOf(velvet), "lunae")).followerCount).toBe(0);
  });

  it("refuses following yourself", async () => {
    const lunae = await member("lunae");
    expect((await captureError(followMember(actorOf(lunae), "lunae"))).status).toBe(400);
  });

  it("hides a banned account's profile", async () => {
    const viewer = await member("viewer");
    const target = await member("gizli");
    await db.update(users).set({ isBanned: true }).where(eq(users.id, target.id));

    expect((await captureError(getProfile(actorOf(viewer), "gizli"))).status).toBe(404);
  });
});

describe("blocks", () => {
  it("ends follows both ways and stops a new follow", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    await followMember(actorOf(velvet), "lunae");
    await followMember(actorOf(lunae), "velvet");

    await blockMember(actorOf(lunae), "velvet");

    expect(await db.select().from(follows)).toHaveLength(0);
    expect((await captureError(followMember(actorOf(velvet), "lunae"))).status).toBe(403);
    expect((await captureError(followMember(actorOf(lunae), "velvet"))).status).toBe(403);
  });

  it("makes the blocker's profile disappear for the blocked, not the reverse", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    await blockMember(actorOf(lunae), "velvet");

    // The blocked member is not told about the block
    expect((await captureError(getProfile(actorOf(velvet), "lunae"))).status).toBe(404);

    const seenByBlocker = await getProfile(actorOf(lunae), "velvet");
    expect(seenByBlocker.viewerBlocked).toBe(true);

    await unblockMember(actorOf(lunae), "velvet");
    expect(await db.select().from(userBlocks)).toHaveLength(0);
    expect((await getProfile(actorOf(velvet), "lunae")).username).toBe("lunae");
  });
});

describe("bookmarks", () => {
  it("saves only published articles, once, and lets them go", async () => {
    const reader = await createUser();
    const published = await article("published");
    const draft = await article("draft");

    await bookmarkArticle(actorOf(reader), published.id);
    await bookmarkArticle(actorOf(reader), published.id);
    expect((await captureError(bookmarkArticle(actorOf(reader), draft.id))).status).toBe(404);

    const list = await listBookmarkedArticles(actorOf(reader));
    expect(list.map((item) => item.slug)).toEqual([published.slug]);
    expect(await isArticleBookmarked(actorOf(reader), published.id)).toBe(true);

    await removeBookmark(actorOf(reader), published.id);
    expect(await listBookmarkedArticles(actorOf(reader))).toHaveLength(0);
  });

  it("drops a saved article from the list once it is no longer published", async () => {
    const reader = await createUser();
    const published = await article("published");
    await bookmarkArticle(actorOf(reader), published.id);

    await db.update(articles).set({ status: "withdrawn" }).where(eq(articles.id, published.id));
    expect(await listBookmarkedArticles(actorOf(reader))).toHaveLength(0);
  });
});

describe("account deletion", () => {
  it("clears the handle and deletes the social graph", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    await followMember(actorOf(velvet), "lunae");
    await blockMember(actorOf(lunae), "velvet");
    await bookmarkArticle(actorOf(lunae), (await article("published")).id);

    await anonymiseUser(lunae.id);

    expect((await reloadUser(lunae.id)).username).toBeNull();
    expect(await db.select().from(follows)).toHaveLength(0);
    expect(await db.select().from(userBlocks)).toHaveLength(0);
    expect(await db.select().from(bookmarks)).toHaveLength(0);

    // The freed handle can be taken again
    const next = await createUser();
    expect(await setUsername(actorOf(next), { username: "lunae" }, noMeta)).toBe("lunae");
  });
});
