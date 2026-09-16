/**
 * Private messages between two members (D-091).
 *
 * The rules, in order: both adults, no block either way, the recipient's
 * preference (everyone / people they follow / nobody), and an answer is
 * always allowed once the recipient wrote — unless they chose "nobody".
 *
 * Nobody reads these but the two members. There is no admin listing: a
 * moderator only ever sees the text of a single message one of the two
 * reported (D-090). A message is still user content, so it is masked and
 * leaves a traffic record like everything else (D-088).
 */
import "server-only";
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  conversationStates,
  conversations,
  directMessages,
  userBlocks,
  users,
  type DmPolicy,
  type Role,
} from "@/db/schema";
import { isAdult } from "@/lib/age";
import type { Executor } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound, rateLimited } from "@/lib/errors";
import { DM_POLICIES, directMessageProblem, orderedPair } from "@/lib/direct-messages";
import { maskBannedWords } from "@/lib/moderation";
import { recordTraffic, trafficCutoff } from "@/lib/traffic";
import { normalizeUsername } from "@/lib/username";
import { activeBannedWords, assertMayPost } from "./community";
import { getMemberSettings, hasBlocked, isFollowing, requireMember } from "./social";
import type { RequestMeta } from "./auth";

export const MAX_DIRECT_MESSAGE_LENGTH = 2000;

/** A burst guard: twenty lines a minute is a fast typist, not a script. */
export const DIRECT_MESSAGES_PER_MINUTE = 20;

type Participant = {
  id: string;
  username: string | null;
  nickname: string | null;
  role: Role;
  bio: string | null;
  birthDate: string | null;
  dmPolicy: DmPolicy;
  isBanned: boolean;
  deletedAt: Date | null;
};

const participantColumns = {
  id: users.id,
  username: users.username,
  nickname: users.nickname,
  role: users.role,
  bio: users.bio,
  birthDate: users.birthDate,
  dmPolicy: users.dmPolicy,
  isBanned: users.isBanned,
  deletedAt: users.deletedAt,
};

async function findParticipantByUsername(rawUsername: string): Promise<Participant | null> {
  const username = normalizeUsername(rawUsername);
  if (username === "") return null;
  const rows = await db
    .select(participantColumns)
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

async function birthDateOf(userId: string): Promise<string | null> {
  const rows = await db.select({ birthDate: users.birthDate }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.birthDate ?? null;
}

/** A missing birth date is not an adult: the age limit cannot be proven. */
function adult(birthDate: string | null): boolean {
  return birthDate !== null && isAdult(birthDate);
}

async function findConversation(a: string, b: string) {
  const [low, high] = orderedPair(a, b);
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.memberAId, low), eq(conversations.memberBId, high)))
    .limit(1);
  return rows[0] ?? null;
}

async function hasWritten(conversationId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: directMessages.id })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.conversationId, conversationId),
        eq(directMessages.senderId, userId),
        isNull(directMessages.deletedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

type MessagingState = { canSend: boolean; problem: string | null };

async function messagingState(
  meId: string,
  other: Participant,
  conversationId: string | null,
): Promise<MessagingState> {
  if (other.isBanned || other.deletedAt || !other.username) {
    return { canSend: false, problem: "Bu hesap artık mesaj alamıyor." };
  }

  const [myBirthDate, blockedOut, blockedIn, followsMe, written] = await Promise.all([
    birthDateOf(meId),
    hasBlocked(meId, other.id),
    hasBlocked(other.id, meId),
    isFollowing(other.id, meId),
    conversationId ? hasWritten(conversationId, other.id) : Promise.resolve(false),
  ]);

  const problem = directMessageProblem({
    senderAdult: adult(myBirthDate),
    recipientAdult: adult(other.birthDate),
    blocked: blockedOut || blockedIn,
    recipientPolicy: other.dmPolicy,
    recipientFollowsSender: followsMe,
    recipientHasWritten: written,
  });
  return { canSend: problem === null, problem };
}

async function markRead(
  executor: Executor,
  conversationId: string,
  userId: string,
  at: Date,
  cleared = false,
): Promise<void> {
  const rows = await executor
    .select({ id: conversationStates.id })
    .from(conversationStates)
    .where(and(eq(conversationStates.conversationId, conversationId), eq(conversationStates.userId, userId)))
    .limit(1);

  const values = cleared ? { lastReadAt: at, clearedAt: at } : { lastReadAt: at };
  if (rows[0]) {
    await executor
      .update(conversationStates)
      .set({ ...values, updatedAt: at })
      .where(eq(conversationStates.id, rows[0].id));
  } else {
    await executor.insert(conversationStates).values({ conversationId, userId, ...values });
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export const directMessageSchema = z.strictObject({
  username: z.string().min(1).max(40),
  body: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz.")
    .max(MAX_DIRECT_MESSAGE_LENGTH, `Mesaj en çok ${MAX_DIRECT_MESSAGE_LENGTH} karakter olabilir.`),
});

export async function sendDirectMessage(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string; conversationId: string }> {
  const me = await requireMember(actor);

  const parsed = directMessageSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Mesaj geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const other = await findParticipantByUsername(parsed.data.username);
  if (!other) throw notFound("Üye bulunamadı.");
  if (other.id === me.id) throw badRequest("Kendinize mesaj gönderemezsiniz.");
  // A member who blocked the sender is not there for them (D-089)
  if (await hasBlocked(other.id, me.id)) throw notFound("Üye bulunamadı.");

  const existing = await findConversation(me.id, other.id);
  const state = await messagingState(me.id, other, existing?.id ?? null);
  if (!state.canSend) throw forbidden(state.problem ?? undefined);

  const [recent] = await db
    .select({ value: count() })
    .from(directMessages)
    .where(and(eq(directMessages.senderId, me.id), gte(directMessages.createdAt, new Date(Date.now() - 60_000))));
  if ((recent?.value ?? 0) >= DIRECT_MESSAGES_PER_MINUTE) {
    throw rateLimited("Çok hızlı mesaj gönderiyorsunuz. Biraz bekleyin.");
  }

  const body = maskBannedWords(parsed.data.body, await activeBannedWords());

  return db.transaction(async (tx) => {
    const now = new Date();
    let conversationId = existing?.id;

    if (conversationId) {
      await tx
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    } else {
      const [low, high] = orderedPair(me.id, other.id);
      const [created] = await tx
        .insert(conversations)
        .values({ memberAId: low, memberBId: high, lastMessageAt: now })
        .returning({ id: conversations.id });
      conversationId = created!.id;
    }

    const [message] = await tx
      .insert(directMessages)
      .values({ conversationId, senderId: me.id, body })
      .returning({ id: directMessages.id });

    await recordTraffic(
      {
        userId: me.id,
        action: "social.direct_message_sent",
        entityType: "direct_messages",
        entityId: message!.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
      tx,
    );

    // Your own message is read by definition
    await markRead(tx, conversationId, me.id, now);

    return { id: message!.id, conversationId };
  });
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type ConversationMessage = { id: string; body: string; createdAt: Date; isOwn: boolean };

export type ConversationView = {
  other: { id: string; username: string; nickname: string | null; role: Role; bio: string | null };
  conversationId: string | null;
  messages: ConversationMessage[];
  canSend: boolean;
  problem: string | null;
  iBlocked: boolean;
};

/** Opens a conversation (or an empty one to start) and marks it read. */
export async function openConversation(actor: Actor, rawUsername: string): Promise<ConversationView> {
  const me = await requireMember(actor);
  const other = await findParticipantByUsername(rawUsername);
  if (!other?.username) throw notFound("Üye bulunamadı.");
  if (other.id === me.id) throw badRequest("Kendinize mesaj gönderemezsiniz.");
  if (await hasBlocked(other.id, me.id)) throw notFound("Üye bulunamadı.");

  const conversation = await findConversation(me.id, other.id);
  const [state, iBlocked] = await Promise.all([
    messagingState(me.id, other, conversation?.id ?? null),
    hasBlocked(me.id, other.id),
  ]);

  let messages: ConversationMessage[] = [];
  if (conversation) {
    const mine = await db
      .select({ clearedAt: conversationStates.clearedAt })
      .from(conversationStates)
      .where(and(eq(conversationStates.conversationId, conversation.id), eq(conversationStates.userId, me.id)))
      .limit(1);
    const clearedAt = mine[0]?.clearedAt ?? null;

    const rows = await db
      .select({
        id: directMessages.id,
        body: directMessages.body,
        createdAt: directMessages.createdAt,
        senderId: directMessages.senderId,
      })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.conversationId, conversation.id),
          isNull(directMessages.deletedAt),
          ...(clearedAt ? [gt(directMessages.createdAt, clearedAt)] : []),
        ),
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(200);

    messages = rows
      .reverse()
      .map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, isOwn: row.senderId === me.id }));

    await markRead(db, conversation.id, me.id, new Date());
  }

  return {
    other: { id: other.id, username: other.username, nickname: other.nickname, role: other.role, bio: other.bio },
    conversationId: conversation?.id ?? null,
    messages,
    canSend: state.canSend,
    problem: state.problem,
    iBlocked,
  };
}

export type ConversationSummary = {
  conversationId: string;
  other: { username: string | null; nickname: string | null; role: Role };
  lastMessage: { body: string; createdAt: Date; isOwn: boolean };
  unread: number;
};

/**
 * The member's conversations, newest first. A conversation they cleared with
 * nothing new since, or one with a member who blocked them, is left out.
 */
export async function listConversations(actor: Actor, limit = 50): Promise<ConversationSummary[]> {
  const me = await requireMember(actor);

  const rows = await db
    .select({
      id: conversations.id,
      memberAId: conversations.memberAId,
      memberBId: conversations.memberBId,
    })
    .from(conversations)
    .where(or(eq(conversations.memberAId, me.id), eq(conversations.memberBId, me.id)))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const otherIds = rows.map((row) => (row.memberAId === me.id ? row.memberBId : row.memberAId));

  const [others, states, blockers] = await Promise.all([
    db
      .select({ id: users.id, username: users.username, nickname: users.nickname, role: users.role })
      .from(users)
      .where(inArray(users.id, otherIds)),
    db
      .select({
        conversationId: conversationStates.conversationId,
        lastReadAt: conversationStates.lastReadAt,
        clearedAt: conversationStates.clearedAt,
      })
      .from(conversationStates)
      .where(and(eq(conversationStates.userId, me.id), inArray(conversationStates.conversationId, ids))),
    db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockedId, me.id), inArray(userBlocks.blockerId, otherIds))),
  ]);

  const otherById = new Map(others.map((other) => [other.id, other]));
  const stateById = new Map(states.map((state) => [state.conversationId, state]));
  const blockedBy = new Set(blockers.map((row) => row.blockerId));

  const summaries = await Promise.all(
    rows.map(async (row, index): Promise<ConversationSummary | null> => {
      const otherId = otherIds[index]!;
      if (blockedBy.has(otherId)) return null;

      const state = stateById.get(row.id);
      const visible = [
        eq(directMessages.conversationId, row.id),
        isNull(directMessages.deletedAt),
        ...(state?.clearedAt ? [gt(directMessages.createdAt, state.clearedAt)] : []),
      ];

      const [last] = await db
        .select({ body: directMessages.body, createdAt: directMessages.createdAt, senderId: directMessages.senderId })
        .from(directMessages)
        .where(and(...visible))
        .orderBy(desc(directMessages.createdAt))
        .limit(1);
      if (!last) return null;

      const readSince = state?.lastReadAt ? [gt(directMessages.createdAt, state.lastReadAt)] : [];
      const [unread] = await db
        .select({ value: count() })
        .from(directMessages)
        .where(
          and(
            ...visible,
            ...readSince,
            or(isNull(directMessages.senderId), ne(directMessages.senderId, me.id)),
          ),
        );

      const other = otherById.get(otherId);
      return {
        conversationId: row.id,
        other: { username: other?.username ?? null, nickname: other?.nickname ?? null, role: other?.role ?? "user" },
        lastMessage: { body: last.body, createdAt: last.createdAt, isOwn: last.senderId === me.id },
        unread: unread?.value ?? 0,
      };
    }),
  );

  return summaries.filter((summary): summary is ConversationSummary => summary !== null);
}

/** How many conversations wait to be read, for the sidebar badge. */
export async function unreadConversationCount(actor: Actor): Promise<number> {
  const { username } = await getMemberSettings(actor);
  if (!username || actor.isBanned || actor.emailVerifiedAt === null) return 0;
  const summaries = await listConversations(actor);
  return summaries.filter((summary) => summary.unread > 0).length;
}

/**
 * "Delete conversation": hides everything so far, for this member only. The
 * other member keeps their copy; a new message opens the conversation again.
 */
export async function clearConversation(actor: Actor, rawUsername: string): Promise<void> {
  const me = await requireMember(actor);
  const username = normalizeUsername(rawUsername);

  // Looked up without the ban filter: clearing a talk with a banned member is fine
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!rows[0]) throw notFound("Konuşma bulunamadı.");

  const conversation = await findConversation(me.id, rows[0].id);
  if (!conversation) throw notFound("Konuşma bulunamadı.");

  await markRead(db, conversation.id, me.id, new Date(), true);
}

export const dmPolicySchema = z.strictObject({
  dmPolicy: z.enum(DM_POLICIES, "Bir tercih seçin."),
});

export async function setDirectMessagePolicy(actor: Actor, rawInput: unknown): Promise<DmPolicy> {
  assertMayPost(actor);
  const parsed = dmPolicySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Tercih geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  await db
    .update(users)
    .set({ dmPolicy: parsed.data.dmPolicy, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
  return parsed.data.dmPolicy;
}

/** Messages gone with an account or removed after a report, past their year. */
export async function pruneDeletedDirectMessages(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(directMessages)
    .where(and(isNotNull(directMessages.deletedAt), lt(directMessages.deletedAt, trafficCutoff(now))))
    .returning({ id: directMessages.id });
  return removed.length;
}
