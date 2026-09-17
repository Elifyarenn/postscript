/**
 * Member posts and content reports (D-090).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  articles,
  communityComments,
  contentReports,
  notifications,
  postLikes,
  posts,
  trafficLogs,
} from "@/db/schema";
import { addBannedWord, addCommunityComment, listCommentsForArticle } from "@/services/community";
import { blockMember, followMember, setUsername } from "@/services/social";
import {
  bookmarkPost,
  countRecentPostActivity,
  createPost,
  deleteOwnPost,
  getPostThread,
  likePost,
  listBookmarkedPosts,
  listExplorePosts,
  listHomeFeed,
  listProfileComments,
  listProfileFeed,
  listProfilePosts,
  POSTS_PER_MINUTE,
  pruneDeletedPosts,
  removePostAsModerator,
  repostPost,
  unlikePost,
} from "@/services/posts";
import {
  listReports,
  pruneResolvedReports,
  reportContent,
  resolveReport,
} from "@/services/reports";
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

async function member(username: string, overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  await setUsername(actorOf(user), { username }, noMeta);
  return reloadUser(user.id);
}

async function post(author: Awaited<ReturnType<typeof member>>, body: string, replyToId?: string) {
  return createPost(actorOf(author), { body, replyToId: replyToId ?? null }, noMeta);
}

async function notificationsOf(userId: string) {
  return db.select().from(notifications).where(eq(notifications.userId, userId));
}

describe("writing posts", () => {
  it("asks for a handle first", async () => {
    const noHandle = await createUser();
    const error = await captureError(createPost(actorOf(noHandle), { body: "merhaba" }, noMeta));
    expect(error.status).toBe(409);
  });

  it("masks banned words and leaves a traffic record in the same step", async () => {
    const admin = await createUser({ role: "admin" });
    await addBannedWord(actorOf(admin), { word: "küfür" }, noMeta);
    const lunae = await member("lunae");

    const created = await post(lunae, "güzel bir gün ama küfür");

    const [row] = await db.select().from(posts).where(eq(posts.id, created.id));
    expect(row!.body).toBe("güzel bir gün ama k****");

    const traffic = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, created.id));
    expect(traffic).toHaveLength(1);
    expect(traffic[0]!.action).toBe("social.post_created");
    expect(traffic[0]!.ip).toBe(noMeta.ip);
  });

  it("refuses a burst beyond the per-minute limit", async () => {
    const lunae = await member("lunae");
    for (let index = 0; index < POSTS_PER_MINUTE; index += 1) {
      await post(lunae, `gönderi ${index}`);
    }
    expect((await captureError(post(lunae, "bir tane daha"))).status).toBe(429);
  });

  it("notifies the author of the answered post, and threads the reply", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const original = await post(lunae, "ilk gönderi");

    const reply = await post(velvet, "yanıt", original.id);
    await post(lunae, "kendime yanıt", original.id);

    const received = await notificationsOf(lunae.id);
    expect(received.map((row) => row.kind)).toEqual(["social.reply"]);

    const thread = await getPostThread(actorOf(lunae), original.id);
    expect(thread.post.replyCount).toBe(2);
    expect(thread.replies.map((item) => item.id)).toContain(reply.id);

    const replyThread = await getPostThread(actorOf(lunae), reply.id);
    expect(replyThread.parent?.id).toBe(original.id);
  });

  it("does not let a blocked member answer, see or like a post", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const original = await post(lunae, "görünmez olacak");
    await blockMember(actorOf(lunae), "velvet");

    expect((await captureError(post(velvet, "yanıt", original.id))).status).toBe(404);
    expect((await captureError(getPostThread(actorOf(velvet), original.id))).status).toBe(404);
    expect((await captureError(likePost(actorOf(velvet), original.id))).status).toBe(404);
    expect((await listExplorePosts(actorOf(velvet))).map((item) => item.id)).not.toContain(original.id);
  });

  it("lets the author delete their own post and nobody else's", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const created = await post(lunae, "silinecek");

    expect((await captureError(deleteOwnPost(actorOf(velvet), created.id))).status).toBe(404);
    await deleteOwnPost(actorOf(lunae), created.id);
    expect((await captureError(getPostThread(actorOf(lunae), created.id))).status).toBe(404);
  });
});

describe("likes, reposts and saves", () => {
  it("likes once, notifies once, and can be taken back", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const created = await post(lunae, "beğenilecek");

    await likePost(actorOf(velvet), created.id);
    await likePost(actorOf(velvet), created.id);
    await likePost(actorOf(lunae), created.id); // own like, no notification

    const thread = await getPostThread(actorOf(velvet), created.id);
    expect(thread.post.likeCount).toBe(2);
    expect(thread.post.viewerLiked).toBe(true);
    expect((await notificationsOf(lunae.id)).map((row) => row.kind)).toEqual(["social.like"]);

    await unlikePost(actorOf(velvet), created.id);
    expect((await getPostThread(actorOf(velvet), created.id)).post.likeCount).toBe(1);
  });

  it("keeps likes private to the profile owner", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const created = await post(velvet, "beğenilen");
    await likePost(actorOf(lunae), created.id);

    const own = await listProfilePosts(actorOf(lunae), "lunae", "favorites");
    expect(own.map((item) => item.id)).toEqual([created.id]);
    expect((await captureError(listProfilePosts(actorOf(velvet), "lunae", "favorites"))).status).toBe(403);
  });

  it("saves a post to the private list", async () => {
    const lunae = await member("lunae");
    const reader = await createUser();
    const created = await post(lunae, "kaydedilecek");

    await bookmarkPost(actorOf(reader), created.id);
    await bookmarkPost(actorOf(reader), created.id);
    const saved = await listBookmarkedPosts(actorOf(reader));
    expect(saved.map((item) => item.id)).toEqual([created.id]);
    expect(saved[0]!.viewerBookmarked).toBe(true);
  });
});

describe("timelines", () => {
  it("shows followed members' posts and reposts, not strangers'", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const ada = await member("ada");

    const lunaePost = await post(lunae, "lunae yazdı");
    const adaPost = await post(ada, "ada yazdı");
    const adaOther = await post(ada, "ada başka yazdı");
    await repostPost(actorOf(lunae), adaPost.id);
    await followMember(actorOf(velvet), "lunae");

    const feed = await listHomeFeed(actorOf(velvet));
    const ids = feed.map((item) => item.id);
    expect(ids).toContain(lunaePost.id);
    expect(ids).toContain(adaPost.id);
    expect(ids).not.toContain(adaOther.id);
    expect(feed.find((item) => item.id === adaPost.id)!.repostedBy?.username).toBe("lunae");
    expect((await notificationsOf(ada.id)).map((row) => row.kind)).toEqual(["social.repost"]);
  });

  it("ranks explore by likes", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const quiet = await post(lunae, "sessiz");
    const loved = await post(lunae, "sevilen");
    await likePost(actorOf(velvet), loved.id);

    const explore = await listExplorePosts(actorOf(velvet));
    expect(explore.map((item) => item.id)).toEqual([loved.id, quiet.id]);
  });

  it("lists a profile's replies on their own tab", async () => {
    const lunae = await member("lunae");
    const original = await post(lunae, "ana");
    const reply = await post(lunae, "yanıt", original.id);

    const postsTab = await listProfilePosts(actorOf(lunae), "lunae", "posts");
    const repliesTab = await listProfilePosts(actorOf(lunae), "lunae", "replies");
    expect(postsTab.map((item) => item.id)).toEqual([original.id]);
    expect(repliesTab.map((item) => item.id)).toEqual([reply.id]);
  });
});

describe("content reports (5651 m. 9)", () => {
  it("files a report, tells the admins, and ignores a duplicate", async () => {
    const admin = await createUser({ role: "admin" });
    const lunae = await member("lunae");
    const reader = await createUser();
    const created = await post(lunae, "bildirilecek");

    const first = await reportContent(
      actorOf(reader),
      { targetType: "post", targetId: created.id, category: "harassment", reason: "taciz" },
      noMeta,
    );
    const again = await reportContent(
      actorOf(reader),
      { targetType: "post", targetId: created.id, category: "spam" },
      noMeta,
    );
    expect(again).toEqual({ id: first.id, duplicate: true });

    expect((await notificationsOf(admin.id)).map((row) => row.kind)).toEqual(["moderation.report"]);

    const open = await listReports(actorOf(admin), "open");
    expect(open).toHaveLength(1);
    expect(open[0]!.snapshot).toBe("bildirilecek");
    expect(open[0]!.overdue).toBe(false);
  });

  it("refuses reporting your own content and keeps the queue from non-admins", async () => {
    const lunae = await member("lunae");
    const created = await post(lunae, "benim");

    const own = await captureError(
      reportContent(actorOf(lunae), { targetType: "post", targetId: created.id, category: "spam" }, noMeta),
    );
    expect(own.status).toBe(400);
    expect((await captureError(listReports(actorOf(lunae), "open"))).status).toBe(403);
  });

  it("removes the content, closes every open report on it and tells each reporter", async () => {
    const admin = await createUser({ role: "admin" });
    const lunae = await member("lunae");
    const first = await createUser();
    const second = await createUser();
    const created = await post(lunae, "kaldırılacak");

    const report = await reportContent(
      actorOf(first),
      { targetType: "post", targetId: created.id, category: "hate" },
      noMeta,
    );
    await reportContent(actorOf(second), { targetType: "post", targetId: created.id, category: "hate" }, noMeta);

    await resolveReport(actorOf(admin), { reportId: report.id, decision: "remove", note: "nefret" }, noMeta);

    const [row] = await db.select().from(posts).where(eq(posts.id, created.id));
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.removedBy).toBe(admin.id);

    const statuses = await db.select({ status: contentReports.status }).from(contentReports);
    expect(statuses.map((item) => item.status)).toEqual(["removed", "removed"]);

    for (const reporter of [first, second]) {
      const kinds = (await notificationsOf(reporter.id)).map((item) => item.kind);
      expect(kinds).toEqual(["moderation.report_resolved"]);
    }

    const again = await captureError(
      resolveReport(actorOf(admin), { reportId: report.id, decision: "dismiss" }, noMeta),
    );
    expect(again.status).toBe(409);
  });

  it("removes a reported comment from the article", async () => {
    const admin = await createUser({ role: "admin" });
    const author = await createUser();
    const reader = await createUser();
    const [article] = await db
      .insert(articles)
      .values({ title: "Yazı", slug: "yazi-rapor", bodyMarkdown: "x", status: "published", publishedAt: new Date() })
      .returning();
    const comment = await addCommunityComment(actorOf(author), { articleId: article!.id, body: "kötü yorum" }, noMeta);

    const report = await reportContent(
      actorOf(reader),
      { targetType: "comment", targetId: comment.id, category: "harassment" },
      noMeta,
    );
    await resolveReport(actorOf(admin), { reportId: report.id, decision: "remove" }, noMeta);

    expect(await listCommentsForArticle(article!.id)).toHaveLength(0);
    const [row] = await db.select().from(communityComments).where(eq(communityComments.id, comment.id));
    expect(row!.deletedAt).not.toBeNull();
  });

  it("dismisses an account report but never 'removes' an account", async () => {
    const admin = await createUser({ role: "admin" });
    const lunae = await member("lunae");
    const reader = await createUser();

    const report = await reportContent(
      actorOf(reader),
      { targetType: "member", targetId: lunae.id, category: "impersonation" },
      noMeta,
    );
    const refused = await captureError(
      resolveReport(actorOf(admin), { reportId: report.id, decision: "remove" }, noMeta),
    );
    expect(refused.status).toBe(400);

    await resolveReport(actorOf(admin), { reportId: report.id, decision: "dismiss" }, noMeta);
    const [row] = await db.select().from(contentReports).where(eq(contentReports.id, report.id));
    expect(row!.status).toBe("dismissed");
  });
});

describe("retention", () => {
  it("prunes deleted posts and closed reports after a year, never open reports", async () => {
    const admin = await createUser({ role: "admin" });
    const lunae = await member("lunae");
    const reader = await createUser();
    const now = new Date("2026-09-13T12:00:00Z");
    const longAgo = new Date("2025-09-01T00:00:00Z");

    const old = await post(lunae, "eski");
    const recent = await post(lunae, "yeni silinen");
    await db.update(posts).set({ deletedAt: longAgo }).where(eq(posts.id, old.id));
    await db.update(posts).set({ deletedAt: new Date("2026-09-01T00:00:00Z") }).where(eq(posts.id, recent.id));

    const live = await post(lunae, "yayında");
    const closed = await reportContent(actorOf(reader), { targetType: "post", targetId: live.id, category: "spam" }, noMeta);
    await resolveReport(actorOf(admin), { reportId: closed.id, decision: "dismiss" }, noMeta);
    await db.update(contentReports).set({ resolvedAt: longAgo }).where(eq(contentReports.id, closed.id));

    const other = await createUser();
    await reportContent(actorOf(other), { targetType: "member", targetId: lunae.id, category: "other" }, noMeta);
    await db.update(contentReports).set({ createdAt: longAgo }).where(eq(contentReports.status, "open"));

    expect(await pruneDeletedPosts(now)).toBe(1);
    expect(await pruneResolvedReports(now)).toBe(1);

    const left = await db.select({ status: contentReports.status }).from(contentReports);
    expect(left.map((row) => row.status)).toEqual(["open"]);
  });

  it("takes an anonymised member's posts and likes out of the community", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const own = await post(lunae, "benim gönderim");
    const theirs = await post(velvet, "onun gönderisi");
    await likePost(actorOf(lunae), theirs.id);

    await anonymiseUser(lunae.id);

    const [row] = await db.select().from(posts).where(eq(posts.id, own.id));
    expect(row!.deletedAt).not.toBeNull();
    expect(
      await db.select().from(postLikes).where(and(eq(postLikes.userId, lunae.id), eq(postLikes.postId, theirs.id))),
    ).toHaveLength(0);
  });
});

describe("a profile's side column and pager (D-150)", () => {
  it("lists what other members answered, newest first, and leaves out the member's own replies", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const ada = await member("ada");
    const original = await post(lunae, "ana gönderi");

    await post(velvet, "bu çok gerçek", original.id);
    await post(lunae, "kendi yanıtım", original.id);
    await post(ada, "hep en güzelini yazıyorsun", original.id);

    const comments = await listProfileComments(actorOf(lunae), "lunae");
    expect(comments.map((item) => item.body)).toEqual([
      "hep en güzelini yazıyorsun",
      "bu çok gerçek",
    ]);
    expect(comments[0]!.author.username).toBe("ada");
  });

  it("hides the replies of someone the viewer blocked", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    const original = await post(lunae, "ana gönderi");
    await post(velvet, "yanıt", original.id);

    await blockMember(actorOf(lunae), "velvet");
    expect(await listProfileComments(actorOf(lunae), "lunae")).toEqual([]);
  });

  it("cuts the posts tab into pages and pulls an out-of-range page back", async () => {
    const lunae = await member("lunae");
    const first = await post(lunae, "birinci");
    const second = await post(lunae, "ikinci");
    const third = await post(lunae, "üçüncü");

    const pageOne = await listProfileFeed(actorOf(lunae), "lunae", "posts", 1, 2);
    expect(pageOne.pageCount).toBe(2);
    expect(pageOne.posts.map((item) => item.id)).toEqual([third.id, second.id]);

    const pageTwo = await listProfileFeed(actorOf(lunae), "lunae", "posts", 2, 2);
    expect(pageTwo.posts.map((item) => item.id)).toEqual([first.id]);

    const beyond = await listProfileFeed(actorOf(lunae), "lunae", "posts", 99, 2);
    expect(beyond.page).toBe(2);
    expect(beyond.posts.map((item) => item.id)).toEqual([first.id]);
  });
});

describe("the community panel's counts (D-180)", () => {
  it("counts the week's posts and the ones a moderator removed, for admins only", async () => {
    const admin = await createUser({ role: "admin" });
    const lunae = await member("lunae");
    await post(lunae, "birinci");
    const second = await post(lunae, "ikinci");
    const own = await post(lunae, "üçüncü");
    await removePostAsModerator(actorOf(admin), second.id, noMeta);
    // A post its author deleted is not a moderator's removal
    await deleteOwnPost(actorOf(lunae), own.id);

    expect(await countRecentPostActivity(actorOf(admin), 7)).toEqual({ shared: 3, removed: 1 });

    const nextMonth = new Date(Date.now() + 30 * 86_400_000);
    expect(await countRecentPostActivity(actorOf(admin), 7, nextMonth)).toEqual({ shared: 0, removed: 0 });

    expect((await captureError(countRecentPostActivity(actorOf(lunae), 7))).status).toBe(403);
  });
});
