/**
 * The community module (module 4): comments on published articles, the chat
 * with quotes, the banned word blacklist, and admin moderation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, communityMessages } from "@/db/schema";
import {
  addBannedWord,
  addChatMessage,
  addCommunityComment,
  listChatMessages,
  listCommentsForArticle,
  removeBannedWord,
  removeChatMessage,
  removeCommunityComment,
} from "@/services/community";
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
});

describe("role badges (data)", () => {
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