/**
 * The anonymous box (D-092).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { anonMessages, trafficLogs, userBlocks } from "@/db/schema";
import {
  clearAnonMutes,
  getAnonComposeState,
  hideAnonMessage,
  listAnonInbox,
  muteAnonSender,
  pruneDeletedAnonMessages,
  sendAnonMessage,
  setAnonBoxEnabled,
  unreadAnonCount,
} from "@/services/anon-box";
import { blockMember, getProfile, setUsername } from "@/services/social";
import { listReports, reportContent, resolveReport } from "@/services/reports";
import { anonymiseUser, exportUserData } from "@/services/users";
import { ANON_BOX_CLOSED, ANON_PER_RECIPIENT_PER_DAY } from "@/lib/anon-box";
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
  return sendAnonMessage(actorOf(from), { username: to, body }, noMeta);
}

/** A recipient with an open box and a sender. */
async function openBox() {
  const lunae = await member("lunae");
  await setAnonBoxEnabled(actorOf(lunae), { enabled: true });
  const velvet = await member("velvet");
  return { lunae, velvet };
}

describe("who may write", () => {
  it("keeps the box closed until the recipient opens it", async () => {
    const lunae = await member("lunae");
    const velvet = await member("velvet");

    const closed = await captureError(send(velvet, "lunae", "selam"));
    expect(closed.status).toBe(403);
    expect(closed.message).toBe(ANON_BOX_CLOSED);
    expect((await getProfile(actorOf(velvet), "lunae")).anonBoxEnabled).toBe(false);

    await setAnonBoxEnabled(actorOf(lunae), { enabled: true });
    await send(velvet, "lunae", "selam");
  });

  it("is for verified members with a handle only", async () => {
    await openBox();
    const noHandle = await createUser();
    const unverified = await createUser({ emailVerified: false });

    expect(
      (await captureError(sendAnonMessage(actorOf(noHandle), { username: "lunae", body: "x" }, noMeta))).status,
    ).toBe(409);
    expect(
      (await captureError(sendAnonMessage(actorOf(unverified), { username: "lunae", body: "x" }, noMeta))).status,
    ).toBe(403);
  });

  it("is closed to minors on both sides, without telling the sender why", async () => {
    const { lunae } = await openBox();
    const minor = await member("genc", { birthDate: "2012-01-01" });
    await setAnonBoxEnabled(actorOf(minor), { enabled: true });

    expect((await captureError(send(minor, "lunae", "selam"))).status).toBe(403);
    const toMinor = await captureError(send(lunae, "genc", "selam"));
    expect(toMinor.message).toBe(ANON_BOX_CLOSED);
  });

  it("limits how many messages one sender leaves in a box per day", async () => {
    const { velvet } = await openBox();
    for (let index = 0; index < ANON_PER_RECIPIENT_PER_DAY; index += 1) {
      await send(velvet, "lunae", `soru ${index}`);
    }
    expect((await captureError(send(velvet, "lunae", "bir daha"))).status).toBe(429);
  });

  it("hides a box from someone the recipient blocked", async () => {
    const { lunae, velvet } = await openBox();
    await blockMember(actorOf(lunae), "velvet");

    expect((await captureError(send(velvet, "lunae", "selam"))).status).toBe(404);
    expect((await captureError(getAnonComposeState(actorOf(velvet), "lunae"))).status).toBe(404);
  });
});

describe("the recipient never learns the sender", () => {
  it("delivers without the sender, but keeps the sender and a traffic record", async () => {
    const { lunae, velvet } = await openBox();
    const sent = await send(velvet, "lunae", "gizli soru");

    expect(await unreadAnonCount(actorOf(lunae))).toBe(1);
    const inbox = await listAnonInbox(actorOf(lunae));
    expect(inbox).toHaveLength(1);
    expect(Object.keys(inbox[0]!).sort()).toEqual(["body", "createdAt", "id", "unread"]);
    expect(JSON.stringify(inbox)).not.toContain(velvet.id);
    expect(await unreadAnonCount(actorOf(lunae))).toBe(0);

    const [stored] = await db.select().from(anonMessages).where(eq(anonMessages.id, sent.id));
    expect(stored!.senderId).toBe(velvet.id);
    const [traffic] = await db.select().from(trafficLogs).where(eq(trafficLogs.entityId, sent.id));
    expect(traffic!.userId).toBe(velvet.id);
  });

  it("mutes a sender without a block that would show on their profile", async () => {
    const { lunae, velvet } = await openBox();
    const sent = await send(velvet, "lunae", "istenmeyen");
    await send(velvet, "lunae", "yine istenmeyen");

    await muteAnonSender(actorOf(lunae), sent.id);

    expect(await listAnonInbox(actorOf(lunae))).toHaveLength(0);
    expect(await db.select().from(userBlocks)).toHaveLength(0);
    expect((await getProfile(actorOf(lunae), "velvet")).viewerBlocked).toBe(false);

    const muted = await captureError(send(velvet, "lunae", "üçüncü"));
    expect(muted.message).toBe(ANON_BOX_CLOSED);

    expect(await clearAnonMutes(actorOf(lunae))).toBe(1);
  });

  it("keeps the sender out of the recipient's KVKK data export", async () => {
    const { lunae, velvet } = await openBox();
    await send(velvet, "lunae", "dışa aktarılacak");
    const [message] = await listAnonInbox(actorOf(lunae));
    await reportContent(
      actorOf(lunae),
      { targetType: "anon_message", targetId: message!.id, category: "harassment" },
      noMeta,
    );

    const recipientExport = JSON.stringify(await exportUserData(actorOf(lunae), lunae.id));
    expect(recipientExport).toContain("dışa aktarılacak");
    expect(recipientExport).not.toContain(velvet.id);

    const senderExport = JSON.stringify(await exportUserData(actorOf(velvet), velvet.id));
    expect(senderExport).toContain("anon_messages_sent");
  });

  it("lets the recipient delete a message from the box", async () => {
    const { lunae, velvet } = await openBox();
    const sent = await send(velvet, "lunae", "silinecek");
    await hideAnonMessage(actorOf(lunae), sent.id);
    expect(await listAnonInbox(actorOf(lunae))).toHaveLength(0);
    // The sender cannot reach into the recipient's box
    expect((await captureError(hideAnonMessage(actorOf(velvet), sent.id))).status).toBe(404);
  });
});

describe("moderation and retention", () => {
  it("shows the sender to the moderator once the recipient reports, and to nobody else", async () => {
    const admin = await createUser({ role: "admin" });
    const { lunae, velvet } = await openBox();
    const outsider = await member("disaridan");
    const sent = await send(velvet, "lunae", "tehdit");

    expect(
      (
        await captureError(
          reportContent(actorOf(outsider), { targetType: "anon_message", targetId: sent.id, category: "harassment" }, noMeta),
        )
      ).status,
    ).toBe(404);

    const report = await reportContent(
      actorOf(lunae),
      { targetType: "anon_message", targetId: sent.id, category: "harassment" },
      noMeta,
    );
    const [queued] = await listReports(actorOf(admin), "open");
    expect(queued!.ownerUsername).toBe("velvet");

    await resolveReport(actorOf(admin), { reportId: report.id, decision: "remove" }, noMeta);
    const [row] = await db.select().from(anonMessages).where(eq(anonMessages.id, sent.id));
    expect(row!.removedBy).toBe(admin.id);
  });

  it("clears both sides on account deletion and prunes after a year", async () => {
    const { lunae, velvet } = await openBox();
    const sent = await send(velvet, "lunae", "gidecek");

    await anonymiseUser(velvet.id);
    expect(await listAnonInbox(actorOf(lunae))).toHaveLength(0);

    await db
      .update(anonMessages)
      .set({ deletedAt: new Date("2025-01-01T00:00:00Z") })
      .where(eq(anonMessages.id, sent.id));
    expect(await pruneDeletedAnonMessages(new Date("2026-09-13T00:00:00Z"))).toBe(1);
  });
});
