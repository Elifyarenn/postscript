/**
 * The anonymous box (D-092): a member opens a box, and other verified adult
 * members may leave a message in it without their name.
 *
 * Anonymous means anonymous to the recipient, and nothing more. The sender is
 * stored with the message and in the traffic record; nothing in this module
 * ever hands the sender to the recipient — not the inbox, not the mute, not
 * the data export. A moderator sees the sender only when the recipient reports
 * the message (D-090).
 */
import "server-only";
import { and, count, desc, eq, gte, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { anonMessages, anonMutes, users } from "@/db/schema";
import { isAdult } from "@/lib/age";
import type { Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound, rateLimited } from "@/lib/errors";
import { anonMessageProblem, MAX_ANON_MESSAGE_LENGTH, type AnonProblem } from "@/lib/anon-box";
import { maskBannedWords } from "@/lib/moderation";
import { recordTraffic, trafficCutoff } from "@/lib/traffic";
import { normalizeUsername } from "@/lib/username";
import { activeBannedWords } from "./community";
import { getMemberSettings, hasBlocked, requireMember } from "./social";
import type { RequestMeta } from "./auth";

type Recipient = {
  id: string;
  username: string;
  nickname: string | null;
  birthDate: string | null;
  anonBoxEnabled: boolean;
};

async function findRecipient(rawUsername: string): Promise<Recipient | null> {
  const username = normalizeUsername(rawUsername);
  if (username === "") return null;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      nickname: users.nickname,
      birthDate: users.birthDate,
      anonBoxEnabled: users.anonBoxEnabled,
    })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt), eq(users.isBanned, false)))
    .limit(1);

  const row = rows[0];
  return row?.username ? { ...row, username: row.username } : null;
}

function adult(birthDate: string | null): boolean {
  return birthDate !== null && isAdult(birthDate);
}

async function problemFor(senderId: string, recipient: Recipient): Promise<AnonProblem | null> {
  const since = new Date(Date.now() - 86_400_000);

  const [sender, blockedOut, muted, [toRecipient], [total]] = await Promise.all([
    db.select({ birthDate: users.birthDate }).from(users).where(eq(users.id, senderId)).limit(1),
    hasBlocked(senderId, recipient.id),
    db
      .select({ id: anonMutes.id })
      .from(anonMutes)
      .where(and(eq(anonMutes.recipientId, recipient.id), eq(anonMutes.senderId, senderId)))
      .limit(1),
    db
      .select({ value: count() })
      .from(anonMessages)
      .where(
        and(
          eq(anonMessages.senderId, senderId),
          eq(anonMessages.recipientId, recipient.id),
          gte(anonMessages.createdAt, since),
        ),
      ),
    db
      .select({ value: count() })
      .from(anonMessages)
      .where(and(eq(anonMessages.senderId, senderId), gte(anonMessages.createdAt, since))),
  ]);

  return anonMessageProblem({
    senderAdult: adult(sender[0]?.birthDate ?? null),
    recipientAdult: adult(recipient.birthDate),
    boxEnabled: recipient.anonBoxEnabled,
    blocked: blockedOut,
    muted: muted.length > 0,
    sentToRecipientToday: toRecipient?.value ?? 0,
    sentTodayTotal: total?.value ?? 0,
  });
}

/** The same lookup for the form and the send: 404 for someone who blocked the sender. */
async function reachableRecipient(senderId: string, rawUsername: string): Promise<Recipient> {
  const recipient = await findRecipient(rawUsername);
  if (!recipient) throw notFound("Üye bulunamadı.");
  if (recipient.id === senderId) throw badRequest("Kendinize anonim mesaj gönderemezsiniz.");
  if (await hasBlocked(recipient.id, senderId)) throw notFound("Üye bulunamadı.");
  return recipient;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export async function getAnonComposeState(actor: Actor, rawUsername: string) {
  const me = await requireMember(actor);
  const recipient = await reachableRecipient(me.id, rawUsername);
  const problem = await problemFor(me.id, recipient);

  return {
    recipient: { username: recipient.username, nickname: recipient.nickname },
    canSend: problem === null,
    problem: problem?.message ?? null,
  };
}

export const anonMessageSchema = z.strictObject({
  username: z.string().min(1).max(40),
  body: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz.")
    .max(MAX_ANON_MESSAGE_LENGTH, `Mesaj en çok ${MAX_ANON_MESSAGE_LENGTH} karakter olabilir.`),
});

/** "Verified users only": `requireMember` insists on a verified, unbanned account with a handle. */
export async function sendAnonMessage(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string }> {
  const me = await requireMember(actor);

  const parsed = anonMessageSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Mesaj geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const recipient = await reachableRecipient(me.id, parsed.data.username);
  const problem = await problemFor(me.id, recipient);
  if (problem) {
    throw problem.status === 429 ? rateLimited(problem.message) : forbidden(problem.message);
  }

  const body = maskBannedWords(parsed.data.body, await activeBannedWords());

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(anonMessages)
      .values({ recipientId: recipient.id, senderId: me.id, body })
      .returning({ id: anonMessages.id });

    // The record names the sender: the box is anonymous to the recipient, not to the law
    await recordTraffic(
      {
        userId: me.id,
        action: "social.anon_message_sent",
        entityType: "anon_messages",
        entityId: row!.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      tx,
    );

    return { id: row!.id };
  });
}

/* ------------------------------------------------------------------ */
/* The recipient's box                                                 */
/* ------------------------------------------------------------------ */

/** Deliberately without the sender: this shape is all the recipient ever gets. */
export type AnonInboxItem = { id: string; body: string; createdAt: Date; unread: boolean };

/** The box, newest first; listing it marks what was unread as read. */
export async function listAnonInbox(actor: Actor): Promise<AnonInboxItem[]> {
  const me = await requireMember(actor);

  const rows = await db
    .select({
      id: anonMessages.id,
      body: anonMessages.body,
      createdAt: anonMessages.createdAt,
      readAt: anonMessages.readAt,
    })
    .from(anonMessages)
    .where(
      and(
        eq(anonMessages.recipientId, me.id),
        isNull(anonMessages.hiddenAt),
        isNull(anonMessages.deletedAt),
      ),
    )
    .orderBy(desc(anonMessages.createdAt))
    .limit(200);

  if (rows.some((row) => row.readAt === null)) {
    const now = new Date();
    await db
      .update(anonMessages)
      .set({ readAt: now, updatedAt: now })
      .where(and(eq(anonMessages.recipientId, me.id), isNull(anonMessages.readAt)));
  }

  return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, unread: row.readAt === null }));
}

export async function unreadAnonCount(actor: Actor): Promise<number> {
  const { username } = await getMemberSettings(actor);
  if (!username || actor.isBanned || actor.emailVerifiedAt === null) return 0;

  const [row] = await db
    .select({ value: count() })
    .from(anonMessages)
    .where(
      and(
        eq(anonMessages.recipientId, actor.id),
        isNull(anonMessages.readAt),
        isNull(anonMessages.hiddenAt),
        isNull(anonMessages.deletedAt),
      ),
    );
  return row?.value ?? 0;
}

async function ownMessage(recipientId: string, messageId: string) {
  if (!z.uuid().safeParse(messageId).success) throw badRequest("Mesaj geçersiz.");
  const rows = await db
    .select({ id: anonMessages.id, senderId: anonMessages.senderId })
    .from(anonMessages)
    .where(and(eq(anonMessages.id, messageId), eq(anonMessages.recipientId, recipientId)))
    .limit(1);
  if (!rows[0]) throw notFound("Mesaj bulunamadı.");
  return rows[0];
}

/** Deletes a message from the recipient's box; it ages out a year later. */
export async function hideAnonMessage(actor: Actor, messageId: string): Promise<void> {
  const me = await requireMember(actor);
  await ownMessage(me.id, messageId);

  const now = new Date();
  await db
    .update(anonMessages)
    .set({ hiddenAt: now, updatedAt: now })
    .where(and(eq(anonMessages.id, messageId), isNull(anonMessages.hiddenAt)));
}

/**
 * Silences the sender of a message without naming them: they can no longer
 * write to this box, and everything they left in it is put away.
 */
export async function muteAnonSender(actor: Actor, messageId: string): Promise<void> {
  const me = await requireMember(actor);
  const message = await ownMessage(me.id, messageId);
  const now = new Date();

  await db.transaction(async (tx) => {
    if (message.senderId) {
      const existing = await tx
        .select({ id: anonMutes.id })
        .from(anonMutes)
        .where(and(eq(anonMutes.recipientId, me.id), eq(anonMutes.senderId, message.senderId)))
        .limit(1);
      if (!existing[0]) {
        await tx.insert(anonMutes).values({ recipientId: me.id, senderId: message.senderId });
      }
    }

    await tx
      .update(anonMessages)
      .set({ hiddenAt: now, updatedAt: now })
      .where(
        and(
          eq(anonMessages.recipientId, me.id),
          isNull(anonMessages.hiddenAt),
          message.senderId ? eq(anonMessages.senderId, message.senderId) : eq(anonMessages.id, message.id),
        ),
      );
  });
}

export async function countAnonMutes(actor: Actor): Promise<number> {
  const [row] = await db.select({ value: count() }).from(anonMutes).where(eq(anonMutes.recipientId, actor.id));
  return row?.value ?? 0;
}

/** Lifts every mute at once; individual mutes cannot be told apart by design. */
export async function clearAnonMutes(actor: Actor): Promise<number> {
  await requireMember(actor);
  const removed = await db
    .delete(anonMutes)
    .where(eq(anonMutes.recipientId, actor.id))
    .returning({ id: anonMutes.id });
  return removed.length;
}

export const anonBoxSettingSchema = z.strictObject({ enabled: z.boolean() });

export async function setAnonBoxEnabled(actor: Actor, rawInput: unknown): Promise<boolean> {
  await requireMember(actor);
  const parsed = anonBoxSettingSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Tercih geçersiz.");

  await db
    .update(users)
    .set({ anonBoxEnabled: parsed.data.enabled, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
  return parsed.data.enabled;
}

/** Removed, gone-with-the-account or box-deleted messages past their year. */
export async function pruneDeletedAnonMessages(now: Date = new Date()): Promise<number> {
  const cutoff = trafficCutoff(now);
  const removed = await db
    .delete(anonMessages)
    .where(or(lt(anonMessages.deletedAt, cutoff), lt(anonMessages.hiddenAt, cutoff)))
    .returning({ id: anonMessages.id });
  return removed.length;
}
