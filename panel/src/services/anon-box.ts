/**
 * The magazine's anonymous box (D-092, D-185).
 *
 * A verified adult member leaves a story, a memory, a confession or a piece of
 * gossip for the "Eğlence & Dedikodu" section. It reaches the admins without
 * the sender's name; they may publish it, unsigned, in the magazine.
 *
 * Anonymous means anonymous to whoever reads the box, and nothing more. The
 * sender is stored with the message and in the traffic record, because the
 * magazine must be able to answer for it (5651 m. 5); nothing in this module
 * hands the sender to the panel. A competent authority's lawful request is
 * answered from the database, not from a screen.
 */
import "server-only";
import { and, count, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { anonMessages, users } from "@/db/schema";
import { isAdult } from "@/lib/age";
import { writeAudit } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound, rateLimited } from "@/lib/errors";
import { anonMessageProblem, MAX_ANON_MESSAGE_LENGTH, type AnonProblem } from "@/lib/anon-box";
import { maskBannedWords } from "@/lib/moderation";
import { recordTraffic, trafficCutoff } from "@/lib/traffic";
import { activeBannedWords } from "./community";
import { requireMember } from "./social";
import type { RequestMeta } from "./auth";

async function problemFor(senderId: string): Promise<AnonProblem | null> {
  const since = new Date(Date.now() - 86_400_000);

  const [sender, [total]] = await Promise.all([
    db.select({ birthDate: users.birthDate }).from(users).where(eq(users.id, senderId)).limit(1),
    db
      .select({ value: count() })
      .from(anonMessages)
      .where(and(eq(anonMessages.senderId, senderId), gte(anonMessages.createdAt, since))),
  ]);

  const birthDate = sender[0]?.birthDate ?? null;
  return anonMessageProblem({
    senderAdult: birthDate !== null && isAdult(birthDate),
    senderBirthDateMissing: birthDate === null,
    sentTodayTotal: total?.value ?? 0,
  });
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export async function getAnonComposeState(actor: Actor) {
  const me = await requireMember(actor);
  const problem = await problemFor(me.id);
  return { canSend: problem === null, problem: problem?.message ?? null };
}

export const anonMessageSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz.")
    .max(MAX_ANON_MESSAGE_LENGTH, `Mesaj en çok ${MAX_ANON_MESSAGE_LENGTH} karakter olabilir.`),
  // The words may be published in the magazine, so the sender agrees to that first (D-185)
  publishConsent: z.literal(true, "Mesajınızın dergide adınız olmadan yayımlanabileceğini onaylayın."),
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

  const problem = await problemFor(me.id);
  if (problem) {
    throw problem.status === 429 ? rateLimited(problem.message) : forbidden(problem.message);
  }

  const body = maskBannedWords(parsed.data.body, await activeBannedWords());

  return db.transaction(async (tx) => {
    // No recipient: the message is the magazine's (D-185)
    const [row] = await tx
      .insert(anonMessages)
      .values({ recipientId: null, senderId: me.id, body })
      .returning({ id: anonMessages.id });

    // The record names the sender: the box is anonymous to its readers, not to the law
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
/* The admins' box                                                     */
/* ------------------------------------------------------------------ */

/** Deliberately without the sender: this shape is all the panel ever gets. */
export type AnonBoxItem = { id: string; body: string; createdAt: Date; unread: boolean };

export type AnonBoxView = "inbox" | "archive";

const magazineBox = isNull(anonMessages.recipientId);

/** The box, newest first. Opening the inbox marks what was unread as read. */
export async function listMagazineAnonBox(actor: Actor, view: AnonBoxView): Promise<AnonBoxItem[]> {
  if (!canModerateCommunity(actor)) throw forbidden();

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
        magazineBox,
        isNull(anonMessages.deletedAt),
        view === "inbox" ? isNull(anonMessages.hiddenAt) : isNotNull(anonMessages.hiddenAt),
      ),
    )
    .orderBy(desc(anonMessages.createdAt))
    .limit(200);

  if (view === "inbox" && rows.some((row) => row.readAt === null)) {
    const now = new Date();
    await db
      .update(anonMessages)
      .set({ readAt: now, updatedAt: now })
      .where(and(magazineBox, isNull(anonMessages.readAt), isNull(anonMessages.hiddenAt)));
  }

  return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, unread: row.readAt === null }));
}

export async function unreadMagazineAnonCount(actor: Actor): Promise<number> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const [row] = await db
    .select({ value: count() })
    .from(anonMessages)
    .where(
      and(magazineBox, isNull(anonMessages.readAt), isNull(anonMessages.hiddenAt), isNull(anonMessages.deletedAt)),
    );
  return row?.value ?? 0;
}

async function magazineMessage(messageId: string) {
  if (!z.uuid().safeParse(messageId).success) throw badRequest("Mesaj geçersiz.");
  const rows = await db
    .select({ id: anonMessages.id })
    .from(anonMessages)
    .where(and(eq(anonMessages.id, messageId), magazineBox, isNull(anonMessages.deletedAt)))
    .limit(1);
  if (!rows[0]) throw notFound("Mesaj bulunamadı.");
}

/** Moves a message out of the inbox (read, used or not wanted); it ages out with the rest. */
export async function archiveAnonMessage(actor: Actor, messageId: string): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();
  await magazineMessage(messageId);

  const now = new Date();
  await db
    .update(anonMessages)
    .set({ hiddenAt: now, readAt: now, updatedAt: now })
    .where(and(eq(anonMessages.id, messageId), isNull(anonMessages.hiddenAt)));
}

/** Takes down a message against the rules. The audit record carries no sender. */
export async function removeAnonMessage(actor: Actor, messageId: string, meta: RequestMeta): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();
  await magazineMessage(messageId);

  const now = new Date();
  await db
    .update(anonMessages)
    .set({ deletedAt: now, removedBy: actor.id, updatedAt: now })
    .where(eq(anonMessages.id, messageId));

  await writeAudit({
    actorId: actor.id,
    action: "social.anon_message_removed",
    entityType: "anon_messages",
    entityId: messageId,
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Retention                                                           */
/* ------------------------------------------------------------------ */

/**
 * Every anonymous message, in the magazine's box or left from a member box,
 * is deleted a year after it was written (D-185). What the magazine published
 * lives on in the article; the link to the sender does not.
 */
export async function pruneDeletedAnonMessages(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(anonMessages)
    .where(lt(anonMessages.createdAt, trafficCutoff(now)))
    .returning({ id: anonMessages.id });
  return removed.length;
}
