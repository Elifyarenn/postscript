/**
 * The community module (module 4): comments on published articles, the chat
 * with quotes, the banned word blacklist, and admin moderation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, communityMessages, trafficLogs } from "@/db/schema";
import { pruneTrafficLogs } from "@/lib/traffic";
import {
  addBannedWord,
  addChatMessage,
  addCommunityComment,
  getChatMessage,
  listChatMessages,
  listChatMessagesAfter,
  listCommentsForArticle,
  removeBannedWord,
  removeChatMessage,
  removeCommunityComment,
} from "@/services/community";
import { setChatMode } from "@/services/chat-mode";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
});

let slugCounter = 0;

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

/** A directly inserted published article, so the comment guard can be tested. */
async function publishedArticle() {
  slugCounter += 1;
  const [row] = await db
    .insert(articles)
    .values({
      title: "Yorumlanacak Yazı",
      slug: `yorumlanacak-${slugCounter}`,
      bodyMarkdown: "gövde",
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  return row!;
}

async function draftArticle() {
  slugCounter += 1;
  const [row] = await db
    .insert(articles)
    .values({
      title: "Taslak",
      slug: `taslak-${slugCounter}`,
      bodyMarkdown: "x",
      status: "draft",
    })
    .returning();
  return row!;
}

/** Opens the chat for a test; the default is passive (D-056). */
async function enableChat() {
  const admin = await createUser({ role: "admin" });
  await setChatMode(actorOf(admin), { mode: "enabled" }, noMeta);
}

describe("banned word blacklist", () => {
  it("lets only an admin add words, normalised to lowercase", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser();

    const refused = await captureError(
      addBannedWord(actorOf(reader), { word: "küfür" }, noMeta),
    );
    expect(refused.status).toBe(403);

    const added = await addBannedWord(actorOf(admin), { word: "  KÜFÜR " }, noMeta);
    expect(added.word).toBe("küfür");
  });

  it("refuses a duplicate word and lets an admin remove it", async () => {
    const admin = await createUser({ role: "admin" });
    const added = await addBannedWord(actorOf(admin), { word: "hakaret" }, noMeta);

    const duplicate = await captureError(
      addBannedWord(actorOf(admin), { word: "HAKARET" }, noMeta),
    );
    expect(duplicate.status).toBe(409);

    await removeBannedWord(actorOf(admin), added.id, noMeta);
    // Now it can be added again
    await addBannedWord(actorOf(admin), { word: "hakaret" }, noMeta);
  });
});

describe("comments on articles", () => {
  it("masks banned words in a comment and keeps the role for the badge", async () => {
    const admin = await createUser({ role: "admin" });
    await addBannedWord(actorOf(admin), { word: "küfür" }, noMeta);
    const article = await publishedArticle();
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const comment = await addCommunityComment(
      actorOf(writer),
      { articleId: article.id, body: "güzel yazı ama küfür" },
      noMeta,
    );
    expect(comment.body).toBe("güzel yazı ama k****");

    const list = await listCommentsForArticle(article.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.authorName).toBe(writer.displayName);
    expect(list[0]!.authorRole).toBe("writer");
  });

  it("refuses a comment on an unpublished article", async () => {
    const article = await draftArticle();
    const reader = await createUser();

    const error = await captureError(
      addCommunityComment(actorOf(reader), { articleId: article.id, body: "yorum" }, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("lets an admin remove a comment (soft delete)", async () => {
    const article = await publishedArticle();
    const reader = await createUser();
    const comment = await addCommunityComment(
      actorOf(reader),
      { articleId: article.id, body: "kaldırılacak" },
      noMeta,
    );

    const admin = await createUser({ role: "admin" });
    await removeCommunityComment(actorOf(admin), comment.id, noMeta);
    expect(await listCommentsForArticle(article.id)).toHaveLength(0);

    const refused = await captureError(
      removeCommunityComment(actorOf(reader), comment.id, noMeta),
    );
    expect(refused.status).toBe(403);
  });
});

describe("community chat", () => {
  beforeEach(async () => {
    await enableChat();
  });

  it("posts messages with quotes, masking banned words", async () => {
    const admin = await createUser({ role: "admin" });
    await addBannedWord(actorOf(admin), { word: "küfür" }, noMeta);

    const first = await createUser();
    const msg = await addChatMessage(actorOf(first), { body: "merhaba", quotedMessageId: null }, noMeta);

    const second = await createUser({ role: "editor" });
    const reply = await addChatMessage(
      actorOf(second),
      { body: "selam ama küfür", quotedMessageId: msg.id },
      noMeta,
    );
    expect(reply.body).toBe("selam ama k****");

    const list = await listChatMessages();
    expect(list).toHaveLength(2);
    const replyItem = list.find((m) => m.id === reply.id)!;
    expect(replyItem.authorRole).toBe("editor");
    expect(replyItem.quotedMessageId).toBe(msg.id);
    expect(replyItem.quotedBody).toBe("merhaba");
  });

  it("refuses a quote of a message that does not exist", async () => {
    const reader = await createUser();
    const error = await captureError(
      addChatMessage(actorOf(reader), { body: "alıntı", quotedMessageId: "00000000-0000-0000-0000-000000000000" }, noMeta),
    );
    expect(error.status).toBe(404);
  });

  it("lets an admin remove a message (soft delete)", async () => {
    const reader = await createUser();
    const msg = await addChatMessage(actorOf(reader), { body: "silinecek" }, noMeta);

    const admin = await createUser({ role: "admin" });
    await removeChatMessage(actorOf(admin), msg.id, noMeta);
    expect(await listChatMessages()).toHaveLength(0);
  });

  it("feeds the live room: only messages after a timestamp come back", async () => {
    const reader = await createUser();
    const first = await addChatMessage(actorOf(reader), { body: "eski mesaj" }, noMeta);
    const marker = first.createdAt;
    const second = await addChatMessage(actorOf(reader), { body: "yeni mesaj" }, noMeta);

    const fresh = await listChatMessagesAfter(marker);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.id).toBe(second.id);

    const everything = await listChatMessagesAfter(new Date(0));
    expect(everything.map((m) => m.id)).toContain(first.id);
  });

  it("returns an enriched message so the room shows the author at once", async () => {
    const editor = await createUser({ role: "editor" });
    const msg = await addChatMessage(actorOf(editor), { body: "merhaba" }, noMeta);

    const enriched = await getChatMessage(msg.id);
    expect(enriched).not.toBeNull();
    expect(enriched!.authorName).toBe(editor.displayName);
    expect(enriched!.authorRole).toBe("editor");
  });
});

describe("passive chat (D-056)", () => {
  it("refuses new messages while the chat is disabled by default", async () => {
    const reader = await createUser();
    const error = await captureError(
      addChatMessage(actorOf(reader), { body: "kapalı" }, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("lets only an admin re-enable the chat", async () => {
    const reader = await createUser();
    const refused = await captureError(
      setChatMode(actorOf(reader), { mode: "enabled" }, noMeta),
    );
    expect(refused.status).toBe(403);

    const admin = await createUser({ role: "admin" });
    await setChatMode(actorOf(admin), { mode: "enabled" }, noMeta);

    const msg = await addChatMessage(actorOf(reader), { body: "açıldı" }, noMeta);
    expect(msg.body).toBe("açıldı");
  });

  it("blocks posting again once an admin turns the chat back off", async () => {
    const admin = await createUser({ role: "admin" });
    await setChatMode(actorOf(admin), { mode: "enabled" }, noMeta);
    await setChatMode(actorOf(admin), { mode: "disabled" }, noMeta);

    const reader = await createUser();
    const error = await captureError(
      addChatMessage(actorOf(reader), { body: "yine kapalı" }, noMeta),
    );
    expect(error.status).toBe(409);
  });
});

describe("role badges (data)", () => {
  beforeEach(async () => {
    await enableChat();
  });

  it("exposes the author role next to each comment and message", async () => {
    const article = await publishedArticle();
    const editor = await createUser({ role: "editor" });
    await addCommunityComment(actorOf(editor), { articleId: article.id, body: "yorum" }, noMeta);
    await addChatMessage(actorOf(editor), { body: "mesaj", quotedMessageId: null }, noMeta);

    const comments = await listCommentsForArticle(article.id);
    expect(comments[0]!.authorRole).toBe("editor");

    const messages = await listChatMessages();
    expect(messages[0]!.authorRole).toBe("editor");
  });
});

describe("self-referential chat integrity", () => {
  beforeEach(async () => {
    await enableChat();
  });

  it("deletes the quote reference when the quoted message row goes away", async () => {
    const reader = await createUser();
    const msg = await addChatMessage(actorOf(reader), { body: "kaynak" }, noMeta);
    const reply = await addChatMessage(actorOf(reader), { body: "cevap", quotedMessageId: msg.id }, noMeta);

    await db
      .update(communityMessages)
      .set({ deletedAt: new Date() })
      .where(eq(communityMessages.id, msg.id));

    const list = await listChatMessages();
    const replyItem = list.find((m) => m.id === reply.id)!;
    expect(replyItem.quotedMessageId).toBe(msg.id);
    expect(replyItem.quotedBody).toBeNull(); // quoted row no longer visible
  });
});
/** D-088: every piece of user content leaves a 5651 traffic record. */
describe("traffic records (D-088)", () => {
  it("records who posted a comment, from where and when", async () => {
    const article = await publishedArticle();
    const reader = await createUser();

    const comment = await addCommunityComment(
      actorOf(reader),
      { articleId: article.id, body: "kayıtlı yorum" },
      noMeta,
    );

    const rows = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, comment.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(reader.id);
    expect(rows[0]!.entityType).toBe("community_comments");
    expect(rows[0]!.ip).toBe(noMeta.ip);
    expect(rows[0]!.userAgent).toBe(noMeta.userAgent);
  });

  it("records a chat message too", async () => {
    await enableChat();
    const reader = await createUser();
    const msg = await addChatMessage(actorOf(reader), { body: "kayıtlı mesaj" }, noMeta);

    const rows = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, msg.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("community.message_added");
  });

  it("prunes only the records older than one year", async () => {
    const reader = await createUser();
    const now = new Date("2026-09-13T12:00:00Z");
    const base = { userId: reader.id, action: "test", entityType: "test", ip: null, userAgent: null };

    await db.insert(trafficLogs).values([
      { ...base, entityId: null, createdAt: new Date("2025-09-01T00:00:00Z") },
      { ...base, entityId: null, createdAt: new Date("2025-09-20T00:00:00Z") },
    ]);

    expect(await pruneTrafficLogs(now)).toBe(1);
    const left = await db.select().from(trafficLogs);
    expect(left).toHaveLength(1);
    expect(left[0]!.createdAt.toISOString()).toBe("2025-09-20T00:00:00.000Z");
  });
});

/**
 * D-072: the chat endpoint used `getAuthContext`, which only proves a session
 * exists. The service asked nothing at all, so a banned account kept posting.
 */
describe("a banned or unverified account cannot post (D-072)", () => {
  it("refuses a chat message from a banned account", async () => {
    const banned = await createUser({ isBanned: true });

    const error = await captureError(addChatMessage(actorOf(banned), { body: "yasaklı" }, noMeta));
    expect(error.status).toBe(403);

    const rows = await db.select().from(communityMessages);
    expect(rows).toHaveLength(0);
  });

  it("refuses a chat message from an unverified account", async () => {
    const unverified = await createUser({ emailVerified: false });

    const error = await captureError(
      addChatMessage(actorOf(unverified), { body: "doğrulanmamış" }, noMeta),
    );
    expect(error.status).toBe(403);
  });

  it("refuses a comment from a banned account", async () => {
    const article = await publishedArticle();
    const banned = await createUser({ isBanned: true });

    const error = await captureError(
      addCommunityComment(actorOf(banned), { articleId: article.id, body: "yasaklı" }, noMeta),
    );
    expect(error.status).toBe(403);

    expect(await listCommentsForArticle(article.id)).toHaveLength(0);
  });

  it("still lets an operational reader post", async () => {
    // The chat is passive by default (D-056), so open it first
    const admin = await createUser({ role: "admin" });
    await setChatMode(actorOf(admin), { mode: "enabled" }, noMeta);

    const reader = await createUser();
    const msg = await addChatMessage(actorOf(reader), { body: "merhaba" }, noMeta);
    expect(msg.body).toBe("merhaba");
  });
});
