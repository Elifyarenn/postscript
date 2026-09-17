/**
 * The magazine's anonymous box (D-092, D-185).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { anonMessages, auditLog, trafficLogs } from "@/db/schema";
import {
  archiveAnonMessage,
  getAnonComposeState,
  listMagazineAnonBox,
  pruneDeletedAnonMessages,
  removeAnonMessage,
  sendAnonMessage,
  unreadMagazineAnonCount,
} from "@/services/anon-box";
import { setUsername } from "@/services/social";
import { exportUserData } from "@/services/users";
import { ANON_PER_SENDER_PER_DAY } from "@/lib/anon-box";
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

function send(from: Member, body: string, publishConsent: unknown = true) {
  return sendAnonMessage(actorOf(from), { body, publishConsent }, noMeta);
}

describe("who may write", () => {
  it("is for verified adult members with a handle only", async () => {
    const noHandle = await createUser();
    const unverified = await createUser({ emailVerified: false });
    const minor = await member("genc", { birthDate: "2012-01-01" });
    const unknownAge = await member("belirsiz", { birthDate: null });

    expect(
      (await captureError(sendAnonMessage(actorOf(noHandle), { body: "x", publishConsent: true }, noMeta))).status,
    ).toBe(409);
    expect(
      (await captureError(sendAnonMessage(actorOf(unverified), { body: "x", publishConsent: true }, noMeta))).status,
    ).toBe(403);
    expect((await captureError(send(minor, "selam"))).status).toBe(403);
    const missing = await captureError(send(unknownAge, "selam"));
    expect(missing.message).toMatch(/doğum tarihi/);
    expect((await getAnonComposeState(actorOf(minor))).canSend).toBe(false);
  });

  it("asks for the publication consent", async () => {
    const velvet = await member("velvet");
    expect((await captureError(send(velvet, "izinsiz", false))).status).toBe(400);
    expect(
      (await captureError(sendAnonMessage(actorOf(velvet), { body: "izinsiz" }, noMeta))).status,
    ).toBe(400);
    expect(await db.select().from(anonMessages)).toHaveLength(0);
  });

  it("limits how many messages one member leaves per day", async () => {
    const velvet = await member("velvet");
    for (let index = 0; index < ANON_PER_SENDER_PER_DAY; index += 1) {
      await send(velvet, `dedikodu ${index}`);
    }
    expect((await captureError(send(velvet, "bir daha"))).status).toBe(429);
  });
});

describe("the admins read it without the sender", () => {
  it("delivers to the magazine, keeps the sender and a traffic record, never shows them", async () => {
    const admin = await createUser({ role: "admin" });
    const velvet = await member("velvet");
    const sent = await send(velvet, "gizli dedikodu");

    const [stored] = await db.select().from(anonMessages).where(eq(anonMessages.id, sent.id));
    expect(stored!.recipientId).toBeNull();
    expect(stored!.senderId).toBe(velvet.id);
    const [traffic] = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, sent.id));
    expect(traffic!.userId).toBe(velvet.id);

    expect(await unreadMagazineAnonCount(actorOf(admin))).toBe(1);
    const box = await listMagazineAnonBox(actorOf(admin), "inbox");
    expect(box).toHaveLength(1);
    expect(Object.keys(box[0]!).sort()).toEqual(["body", "createdAt", "id", "unread"]);
    expect(JSON.stringify(box)).not.toContain(velvet.id);
    expect(await unreadMagazineAnonCount(actorOf(admin))).toBe(0);
  });

  it("is the admins' alone", async () => {
    const editor = await createUser({ role: "editor" });
    const velvet = await member("velvet");
    const sent = await send(velvet, "yalnızca yöneticiler");

    expect((await captureError(listMagazineAnonBox(actorOf(editor), "inbox"))).status).toBe(403);
    expect((await captureError(listMagazineAnonBox(actorOf(velvet), "inbox"))).status).toBe(403);
    expect((await captureError(archiveAnonMessage(actorOf(velvet), sent.id))).status).toBe(403);
  });

  it("archives and removes, with an audit record that names no sender", async () => {
    const admin = await createUser({ role: "admin" });
    const velvet = await member("velvet");
    const kept = await send(velvet, "arşivlenecek");
    const bad = await send(velvet, "kurallara aykırı");

    await archiveAnonMessage(actorOf(admin), kept.id);
    expect((await listMagazineAnonBox(actorOf(admin), "archive")).map((item) => item.id)).toEqual([kept.id]);

    await removeAnonMessage(actorOf(admin), bad.id, noMeta);
    expect(await listMagazineAnonBox(actorOf(admin), "inbox")).toHaveLength(0);
    const [audit] = await db.select().from(auditLog).where(eq(auditLog.entityId, bad.id));
    expect(audit!.action).toBe("social.anon_message_removed");
    expect(JSON.stringify(audit)).not.toContain(velvet.id);
  });

  it("keeps the message in the sender's own KVKK export", async () => {
    const velvet = await member("velvet");
    await send(velvet, "dışa aktarılacak");
    const senderExport = JSON.stringify(await exportUserData(actorOf(velvet), velvet.id));
    expect(senderExport).toContain("anon_messages_sent");
    expect(senderExport).toContain("dışa aktarılacak");
  });
});

describe("retention", () => {
  it("deletes every anonymous message a year after it was written", async () => {
    const velvet = await member("velvet");
    const old = await send(velvet, "eski");
    const fresh = await send(velvet, "yeni");
    await db
      .update(anonMessages)
      .set({ createdAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(anonMessages.id, old.id));

    expect(await pruneDeletedAnonMessages(new Date("2026-09-17T00:00:00Z"))).toBe(1);
    const left = await db.select({ id: anonMessages.id }).from(anonMessages);
    expect(left.map((row) => row.id)).toEqual([fresh.id]);
  });
});
