/**
 * Community module (module 4): comments on published articles, the community
 * chat, and the banned word blacklist that masks both.
 *
 * Every stored body passes through the blacklist first: banned words are
 * replaced with stars at write time, so what is rendered is always already
 * clean. The blacklist itself is admin-curated; removal is a soft delete.
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  bannedWords,
  communityComments,
  communityMessages,
  users,
  type CommunityComment,
  type CommunityMessage,
  type Role,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { maskBannedWords, normalizeBannedWord } from "@/lib/moderation";
import type { RequestMeta } from "./auth";

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_MESSAGE_LENGTH = 1000;
export const CHAT_LIMIT = 50;

/* ------------------------------------------------------------------ */
/* Blacklist                                                           */
/* ------------------------------------------------------------------ */

/** The live words, normalized, as plain strings (the masker's input). */
export async function activeBannedWords(): Promise<string[]> {
  const rows = await db
    .select({ word: bannedWords.word })
    .from(bannedWords)
    .where(isNull(bannedWords.deletedAt));
  return rows.map((row) => row.word);
}

export const bannedWordSchema = z.strictObject({
  word: z.string().trim().min(2, "Kelime en az 2 karakter olmalı.").max(100),
});

/** Adds a word to the blacklist; duplicates (even soft-deleted) are refused. */
export async function addBannedWord(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string; word: string }> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const parsed = bannedWordSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Kelime geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const word = normalizeBannedWord(parsed.data.word);
  if (word === "") throw badRequest("Kelime boş olamaz.");

  const existing = await db
    .select({ id: bannedWords.id })
    .from(bannedWords)
    .where(and(eq(bannedWords.word, word), isNull(bannedWords.deletedAt)))
    .limit(1);
  if (existing[0]) throw conflict("Bu kelime zaten listede.");

  const [row] = await db
    .insert(bannedWords)
    .values({ word, createdBy: actor.id })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "community.banned_word_added",
    entityType: "banned_words",
    entityId: row!.id,
    after: { word },
    ip: meta.ip,
  });

  return { id: row!.id, word: row!.word };
}

/** Removes a word (soft delete) so it can be restored later. */
export async function removeBannedWord(
  actor: Actor,
  wordId: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const [row] = await db
    .update(bannedWords)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(bannedWords.id, wordId), isNull(bannedWords.deletedAt)))
    .returning();

  if (!row) throw notFound("Kelime bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "community.banned_word_removed",
    entityType: "banned_words",
    entityId: wordId,
    before: { word: row.word },
    ip: meta.ip,
  });
}

/** Masks the text with the current blacklist before it is stored. */
async function mask(text: string): Promise<string> {
  const words = await activeBannedWords();
  return maskBannedWords(text, words);
}

/* ------------------------------------------------------------------ */
/* Comments on articles                                                */
/* ------------------------------------------------------------------ */

export const communityCommentSchema = z.strictObject({
  articleId: z.uuid(),
  body: z.string().trim().min(1, "Yorum boş olamaz.").max(MAX_COMMENT_LENGTH),
});

export async function addCommunityComment(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<CommunityComment> {
  const parsed = communityCommentSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Yorum geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  // The article must exist and be live; only published work is commentable
  const article = await db
    .select({ id: articles.id, status: articles.status })
    .from(articles)
    .where(and(eq(articles.id, parsed.data.articleId), isNull(articles.deletedAt)))
    .limit(1);
  if (!article[0]) throw notFound("Yazı bulunamadı.");
  if (article[0].status !== "published") {
    throw conflict("Yalnızca yayınlanmış yazılar yorumlanabilir.");
  }

  const body = await mask(parsed.data.body);

  const [row] = await db
    .insert(communityComments)
    .values({ articleId: parsed.data.articleId, authorId: actor.id, body })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "community.comment_added",
    entityType: "community_comments",
    entityId: row!.id,
    after: { articleId: parsed.data.articleId },
    ip: meta.ip,
  });

  return row!;
}

export type CommentListItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
  authorRole: Role | null;
};

/** The visible comments of one article, newest last. */
export async function listCommentsForArticle(
  articleId: string,
  limit = 100,
): Promise<CommentListItem[]> {
  const rows = await db
    .select({
      id: communityComments.id,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      authorName: users.displayName,
      authorRole: users.role,
    })
    .from(communityComments)
    .leftJoin(users, eq(communityComments.authorId, users.id))
    .where(
      and(
        eq(communityComments.articleId, articleId),
        isNull(communityComments.deletedAt),
      ),
    )
    .orderBy(desc(communityComments.createdAt))
    .limit(limit);

  return [...rows].reverse();
}

/** Admin moderation: removes a comment; the row stays as history. */
export async function removeCommunityComment(
  actor: Actor,
  commentId: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const [row] = await db
    .update(communityComments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(communityComments.id, commentId), isNull(communityComments.deletedAt)))
    .returning();

  if (!row) throw notFound("Yorum bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "community.comment_removed",
    entityType: "community_comments",
    entityId: commentId,
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Community chat                                                      */
/* ------------------------------------------------------------------ */

export const chatMessageSchema = z.strictObject({
  body: z.string().trim().min(1, "Mesaj boş olamaz.").max(MAX_MESSAGE_LENGTH),
  quotedMessageId: z.uuid().optional().nullable(),
});

export async function addChatMessage(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<CommunityMessage> {
  const parsed = chatMessageSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Mesaj geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  if (parsed.data.quotedMessageId) {
    const quoted = await db
      .select({ id: communityMessages.id })
      .from(communityMessages)
      .where(eq(communityMessages.id, parsed.data.quotedMessageId))
      .limit(1);
    if (!quoted[0]) throw notFound("Alıntılanan mesaj bulunamadı.");
  }

  const body = await mask(parsed.data.body);

  const [row] = await db
    .insert(communityMessages)
    .values({
      authorId: actor.id,
      body,
      quotedMessageId: parsed.data.quotedMessageId ?? null,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "community.message_added",
    entityType: "community_messages",
    entityId: row!.id,
    after: { quotedMessageId: row!.quotedMessageId },
    ip: meta.ip,
  });

  return row!;
}

export type MessageListItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string | null;
  authorRole: Role | null;
  quotedMessageId: string | null;
  quotedBody: string | null;
  quotedAuthorName: string | null;
};

/** The newest chat messages, oldest first for display. */
export async function listChatMessages(limit = CHAT_LIMIT): Promise<MessageListItem[]> {
  const quoted = alias(communityMessages, "quoted");
  const quotedAuthor = alias(users, "quoted_author");

  const rows = await db
    .select({
      id: communityMessages.id,
      body: communityMessages.body,
      createdAt: communityMessages.createdAt,
      authorName: users.displayName,
      authorRole: users.role,
      quotedMessageId: communityMessages.quotedMessageId,
      quotedBody: quoted.body,
      quotedAuthorName: quotedAuthor.displayName,
    })
    .from(communityMessages)
    .leftJoin(users, eq(communityMessages.authorId, users.id))
    .leftJoin(quoted, and(eq(communityMessages.quotedMessageId, quoted.id), isNull(quoted.deletedAt)))
    .leftJoin(quotedAuthor, eq(quoted.authorId, quotedAuthor.id))
    .where(isNull(communityMessages.deletedAt))
    .orderBy(desc(communityMessages.createdAt))
    .limit(limit);

  return [...rows].reverse();
}

/** Admin moderation: removes a message (soft delete, stays as history). */
export async function removeChatMessage(
  actor: Actor,
  messageId: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const [row] = await db
    .update(communityMessages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(communityMessages.id, messageId), isNull(communityMessages.deletedAt)))
    .returning();

  if (!row) throw notFound("Mesaj bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "community.message_removed",
    entityType: "community_messages",
    entityId: messageId,
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Admin lists (moderation overview)                                   */
/* ------------------------------------------------------------------ */

/** All comments (including removed), newest first, for the admin screen. */
export async function listAllCommentsForAdmin(actor: Actor, limit = 200) {
  if (!canModerateCommunity(actor)) throw forbidden();

  const rows = await db
    .select({
      id: communityComments.id,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      deletedAt: communityComments.deletedAt,
      authorName: users.displayName,
      articleTitle: articles.title,
    })
    .from(communityComments)
    .leftJoin(users, eq(communityComments.authorId, users.id))
    .innerJoin(articles, eq(communityComments.articleId, articles.id))
    .orderBy(desc(communityComments.createdAt))
    .limit(limit);

  return rows;
}

/** All chat messages (including removed), newest first, for the admin screen. */
export async function listAllMessagesForAdmin(actor: Actor, limit = 200) {
  if (!canModerateCommunity(actor)) throw forbidden();

  return db
    .select({
      id: communityMessages.id,
      body: communityMessages.body,
      createdAt: communityMessages.createdAt,
      deletedAt: communityMessages.deletedAt,
      authorName: users.displayName,
    })
    .from(communityMessages)
    .leftJoin(users, eq(communityMessages.authorId, users.id))
    .orderBy(desc(communityMessages.createdAt))
    .limit(limit);
}

/** The full blacklist, including removed entries, for the admin screen. */
export async function listAllBannedWords(actor: Actor) {
  if (!canModerateCommunity(actor)) throw forbidden();
  return db
    .select()
    .from(bannedWords)
    .orderBy(desc(bannedWords.createdAt))
    .limit(500);
}