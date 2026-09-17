/**
 * Private messages (D-091).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { conversations, directMessages, trafficLogs } from "@/db/schema";
import {
  clearConversation,
  DIRECT_MESSAGES_PER_MINUTE,
  listConversations,
  openConversation,
  pruneDeletedDirectMessages,
  sendDirectMessage,
  setDirectMessagePolicy,
  setReadReceipts,
  unreadConversationCount,
} from "@/services/direct-messages";
import { blockMember, followMember, setUsername } from "@/services/social";
import { reportContent, resolveReport } from "@/services/reports";
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

type Member = Awaited<ReturnType<typeof member>>;

function send(from: Member, to: string, body: string) {
  return sendDirectMessage(actorOf(from), { username: to, body }, noMeta);
}

/** Two adults where the recipient accepts everyone, the simplest open door. */
async function openPair() {
  const lunae = await member("lunae");
  const velvet = await member("velvet");
  await setDirectMessagePolicy(actorOf(velvet), { dmPolicy: "everyone" });
  await setDirectMessagePolicy(actorOf(lunae), { dmPolicy: "everyone" });
  return { lunae, velvet };
}

describe("who may write", () => {
  it("asks for a handle", async () => {
    await member("velvet");
    const noHandle = await createUser();
    const error = await captureError(
      sendDirectMessage(actorOf(noHandle), { username: "velvet", body: "selam" }, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("keeps strangers out by default and lets in someone the recipient follows", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");

    expect((await captureError(send(lunae, "velvet", "selam"))).status).toBe(403);

    await followMember(actorOf(velvet), "lunae");
    await send(lunae, "velvet", "selam");
  });

  it("always lets a member answer someone who wrote to them first", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");
    await followMember(actorOf(velvet), "lunae");
    await send(lunae, "velvet", "selam");

    // velvet is not followed by lunae, but lunae wrote first
    await send(velvet, "lunae", "merhaba");
  });

  it("means nobody when the recipient says nobody", async () => {
    const { lunae, velvet } = await openPair();
    await send(lunae, "velvet", "selam");
    await setDirectMessagePolicy(actorOf(lunae), { dmPolicy: "nobody" });

    expect((await captureError(send(velvet, "lunae", "yanıt"))).status).toBe(403);
  });

  it("is closed to minors on either side, and to a missing birth date", async () => {
    const adult = await member("yetiskin");
    await setDirectMessagePolicy(actorOf(adult), { dmPolicy: "everyone" });
    const minor = await member("genc", { birthDate: "2012-01-01" });
    await setDirectMessagePolicy(actorOf(minor), { dmPolicy: "everyone" });
    const unknown = await member("belirsiz", { birthDate: null });

    expect((await captureError(send(minor, "yetiskin", "selam"))).status).toBe(403);
    const toMinor = await captureError(send(adult, "genc", "selam"));
    expect(toMinor.status).toBe(403);
    expect(toMinor.message).not.toMatch(/18/);
    expect((await captureError(send(unknown, "yetiskin", "selam"))).status).toBe(403);
  });

  it("stops at a block, and hides the blocker from the blocked", async () => {
    const { lunae, velvet } = await openPair();
    await blockMember(actorOf(lunae), "velvet");

    expect((await captureError(send(lunae, "velvet", "selam"))).status).toBe(403);
    expect((await captureError(send(velvet, "lunae", "selam"))).status).toBe(404);
    expect((await captureError(openConversation(actorOf(velvet), "lunae"))).status).toBe(404);

    const view = await openConversation(actorOf(lunae), "velvet");
    expect(view.canSend).toBe(false);
    expect(view.iBlocked).toBe(true);
  });

  it("refuses a burst beyond the per-minute limit", async () => {
    const { lunae } = await openPair();
    for (let index = 0; index < DIRECT_MESSAGES_PER_MINUTE; index += 1) {
      await send(lunae, "velvet", `mesaj ${index}`);
    }
    expect((await captureError(send(lunae, "velvet", "fazla"))).status).toBe(429);
  });
});

describe("conversations", () => {
  it("keeps one conversation per pair, whoever writes first, with a traffic record", async () => {
    const { lunae, velvet } = await openPair();
    const first = await send(velvet, "lunae", "selam");
    const second = await send(lunae, "velvet", "merhaba");

    expect(first.conversationId).toBe(second.conversationId);
    expect(await db.select().from(conversations)).toHaveLength(1);

    const view = await openConversation(actorOf(lunae), "velvet");
    expect(view.messages.map((message) => [message.body, message.isOwn])).toEqual([
      ["selam", false],
      ["merhaba", true],
    ]);

    const traffic = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, first.id));
    expect(traffic[0]!.entityType).toBe("direct_messages");
  });

  it("counts unread conversations and clears the count on opening", async () => {
    const { lunae, velvet } = await openPair();
    await send(lunae, "velvet", "bir");
    await send(lunae, "velvet", "iki");

    expect(await unreadConversationCount(actorOf(velvet))).toBe(1);
    const [summary] = await listConversations(actorOf(velvet));
    expect(summary!.unread).toBe(2);
    expect(summary!.lastMessage.body).toBe("iki");
    expect(await unreadConversationCount(actorOf(lunae))).toBe(0);

    await openConversation(actorOf(velvet), "lunae");
    expect(await unreadConversationCount(actorOf(velvet))).toBe(0);
  });

  it("marks the sender's own messages read once the other member opens the conversation (D-184)", async () => {
    const { lunae, velvet } = await openPair();
    await send(lunae, "velvet", "bir");

    let view = await openConversation(actorOf(lunae), "velvet");
    expect(view.messages.map((message) => message.readByOther)).toEqual([false]);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await openConversation(actorOf(velvet), "lunae");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await send(lunae, "velvet", "iki");

    view = await openConversation(actorOf(lunae), "velvet");
    expect(view.messages.map((message) => [message.body, message.readByOther])).toEqual([
      ["bir", true],
      ["iki", false],
    ]);

    // The other member's own view never marks their incoming messages
    const theirs = await openConversation(actorOf(velvet), "lunae");
    expect(theirs.messages.every((message) => !message.readByOther)).toBe(true);
  });

  it("hides the ticks both ways when either member turns read receipts off (D-188)", async () => {
    const { lunae, velvet } = await openPair();
    await send(lunae, "velvet", "bir");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await openConversation(actorOf(velvet), "lunae");

    const ticks = async () =>
      (await openConversation(actorOf(lunae), "velvet")).messages.map((message) => message.readByOther);
    expect(await ticks()).toEqual([true]);

    // The reader turns it off: their reading is no longer shown
    await setReadReceipts(actorOf(velvet), { enabled: false });
    expect(await ticks()).toEqual([false]);

    // The sender turns it off instead: they see nobody's reading either
    await setReadReceipts(actorOf(velvet), { enabled: true });
    await setReadReceipts(actorOf(lunae), { enabled: false });
    expect(await ticks()).toEqual([false]);

    await setReadReceipts(actorOf(lunae), { enabled: true });
    expect(await ticks()).toEqual([true]);
  });

  it("clears a conversation for one member only, until a new message arrives", async () => {
    const { lunae, velvet } = await openPair();
    await send(lunae, "velvet", "eski");

    await clearConversation(actorOf(velvet), "lunae");
    expect((await openConversation(actorOf(velvet), "lunae")).messages).toHaveLength(0);
    expect(await listConversations(actorOf(velvet))).toHaveLength(0);
    expect((await openConversation(actorOf(lunae), "velvet")).messages).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await send(lunae, "velvet", "yeni");
    const view = await openConversation(actorOf(velvet), "lunae");
    expect(view.messages.map((message) => message.body)).toEqual(["yeni"]);
  });

  it("gives the badge and the list the same answer across several conversations (D-171)", async () => {
    const { lunae, velvet } = await openPair();
    const kestrel = await member("kestrel");
    const moss = await member("moss");
    const quiet = await member("quiet");
    for (const other of [kestrel, moss, quiet]) {
      await setDirectMessagePolicy(actorOf(other), { dmPolicy: "everyone" });
    }

    // Unread from lunae, answered to kestrel, cleared from quiet, blocked by moss.
    // Writing marks a conversation read for the writer, so velvet's own
    // message comes before lunae's.
    await send(velvet, "lunae", "selam");
    await send(lunae, "velvet", "okunmadı");
    await send(kestrel, "velvet", "okundu");
    await send(velvet, "kestrel", "teşekkürler");
    await send(quiet, "velvet", "silindi");
    await clearConversation(actorOf(velvet), "quiet");
    await send(moss, "velvet", "engel");
    await blockMember(actorOf(moss), "velvet");

    const list = await listConversations(actorOf(velvet));
    expect(list.map((summary) => [summary.other.username, summary.unread])).toEqual([
      ["kestrel", 0],
      ["lunae", 1],
    ]);
    expect(list[0]!.lastMessage).toMatchObject({ body: "teşekkürler", isOwn: true });
    expect(list[1]!.lastMessage).toMatchObject({ body: "okunmadı", isOwn: false });
    expect(await unreadConversationCount(actorOf(velvet))).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await send(quiet, "velvet", "yeniden");
    expect(await unreadConversationCount(actorOf(velvet))).toBe(2);
    expect((await listConversations(actorOf(velvet))).map((summary) => summary.other.username)).toEqual([
      "quiet",
      "kestrel",
      "lunae",
    ]);
  });
});

describe("reports and retention", () => {
  it("lets only a member of the conversation report a message, and removal hides it for both", async () => {
    const admin = await createUser({ role: "admin" });
    const { lunae, velvet } = await openPair();
    const outsider = await createUser();
    const sent = await send(lunae, "velvet", "kaba mesaj");

    const foreign = await captureError(
      reportContent(actorOf(outsider), { targetType: "direct_message", targetId: sent.id, category: "harassment" }, noMeta),
    );
    expect(foreign.status).toBe(404);

    const report = await reportContent(
      actorOf(velvet),
      { targetType: "direct_message", targetId: sent.id, category: "harassment" },
      noMeta,
    );
    await resolveReport(actorOf(admin), { reportId: report.id, decision: "remove" }, noMeta);

    expect((await openConversation(actorOf(velvet), "lunae")).messages).toHaveLength(0);
    expect((await openConversation(actorOf(lunae), "velvet")).messages).toHaveLength(0);
    const [row] = await db.select().from(directMessages).where(eq(directMessages.id, sent.id));
    expect(row!.removedBy).toBe(admin.id);
  });

  it("takes an anonymised member's messages away and prunes them after a year", async () => {
    const { lunae, velvet } = await openPair();
    const sent = await send(lunae, "velvet", "gidecek");

    await anonymiseUser(lunae.id);
    const [row] = await db.select().from(directMessages).where(eq(directMessages.id, sent.id));
    expect(row!.deletedAt).not.toBeNull();
    expect(await listConversations(actorOf(velvet))).toHaveLength(0);

    await db
      .update(directMessages)
      .set({ deletedAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(directMessages.id, sent.id));
    expect(await pruneDeletedDirectMessages(new Date("2026-09-13T00:00:00Z"))).toBe(1);
  });
});
