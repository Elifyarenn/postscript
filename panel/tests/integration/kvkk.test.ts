/**
 * The KVKK notice (D-104): versions, telling members about a material change,
 * and the "I have read it" record that keeps its history in the audit log.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, kvkkVersions, notifications, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import {
  acknowledgeKvkkNotice,
  needsKvkkNotice,
  publishKvkkVersion,
} from "@/services/kvkk";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser } from "../helpers/factories";

const BODY = "Bu aydınlatma metni yalnızca test için yazıldı ve elli karakterden uzun olmalı.";

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

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

function input(overrides: { bodyMarkdown?: string; notifyMembers?: boolean } = {}) {
  return {
    title: "KVKK Aydınlatma Metni",
    bodyMarkdown: overrides.bodyMarkdown ?? BODY,
    notifyMembers: overrides.notifyMembers ?? false,
  };
}

describe("publishKvkkVersion", () => {
  it("is refused to anyone but an admin", async () => {
    const editor = await createUser({ role: "editor" });
    const error = await captureError(publishKvkkVersion(actorOf(editor), input(), noMeta));
    expect(error.message).toBe("Bu işlem için yetkiniz yok.");
    expect(await db.select().from(kvkkVersions)).toHaveLength(0);
  });

  it("rejects a body too short to be a notice", async () => {
    const admin = await createUser({ role: "admin" });
    const error = await captureError(
      publishKvkkVersion(actorOf(admin), input({ bodyMarkdown: "Kısa." }), noMeta),
    );
    expect(error.message).toBe("Aydınlatma metni geçersiz.");
  });

  it("numbers versions, keeps one current and tells nobody about a minor change", async () => {
    const admin = await createUser({ role: "admin" });
    await createUser();

    const first = await publishKvkkVersion(actorOf(admin), input(), noMeta);
    const second = await publishKvkkVersion(
      actorOf(admin),
      input({ bodyMarkdown: `${BODY} Ek cümle.` }),
      noMeta,
    );

    expect([first.version, second.version]).toEqual([1, 2]);
    expect(second.notified).toBe(0);
    const current = await db.select().from(kvkkVersions).where(eq(kvkkVersions.isCurrent, true));
    expect(current.map((row) => row.version)).toEqual([2]);
    expect(await db.select().from(notifications)).toHaveLength(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("notifies and mails every member who can sign in when the change is material", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser({ email: "reader@example.com" });
    await createUser({ email: "unverified@example.com", emailVerified: false });
    const deleted = await createUser({ email: "deleted@example.com" });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));

    const result = await publishKvkkVersion(actorOf(admin), input({ notifyMembers: true }), noMeta);

    expect(result.notified).toBe(2);
    const rows = await db
      .select({ userId: notifications.userId, kind: notifications.kind, href: notifications.href })
      .from(notifications);
    expect(rows.map((row) => row.userId).sort()).toEqual([admin.id, reader.id].sort());
    expect(rows.every((row) => row.kind === "kvkk.new_version" && row.href === "/kvkk")).toBe(true);
    expect(mailbox.lastTo("reader@example.com")?.subject).toContain("sürüm 1");
    expect(mailbox.lastTo("unverified@example.com")).toBeUndefined();
    expect(mailbox.lastTo("deleted@example.com")).toBeUndefined();
  });
});

describe("needsKvkkNotice", () => {
  it("shows the banner only while the member is behind the current version", () => {
    const current = { version: 2, title: "KVKK Aydınlatma Metni" };
    expect(needsKvkkNotice(null, null)).toBe(false);
    expect(needsKvkkNotice(null, current)).toBe(true);
    expect(needsKvkkNotice(1, current)).toBe(true);
    expect(needsKvkkNotice(2, current)).toBe(false);
  });
});

describe("acknowledgeKvkkNotice", () => {
  async function twoVersions() {
    const admin = await createUser({ role: "admin" });
    await publishKvkkVersion(actorOf(admin), input(), noMeta);
    await publishKvkkVersion(actorOf(admin), input({ bodyMarkdown: `${BODY} İkinci.` }), noMeta);
  }

  async function readEntries(userId: string) {
    return db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "user.kvkk_notice_read"), eq(auditLog.entityId, userId)));
  }

  it("records the read version and keeps the previous one in the audit log", async () => {
    await twoVersions();
    // The factory registers members against version 1
    const reader = await createUser();

    await acknowledgeKvkkNotice(actorOf(reader), "2", noMeta);

    expect((await reloadUser(reader.id)).kvkkConsentVersion).toBe(2);
    const entries = await readEntries(reader.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.before).toMatchObject({ version: 1 });
    expect(entries[0]!.after).toMatchObject({ version: 2 });
  });

  it("refuses a version that is no longer current", async () => {
    await twoVersions();
    const reader = await createUser();

    const error = await captureError(acknowledgeKvkkNotice(actorOf(reader), "1", noMeta));

    expect(error.message).toContain("güncellendi");
    expect((await reloadUser(reader.id)).kvkkConsentVersion).toBe(1);
  });

  it("records a double submit only once", async () => {
    await twoVersions();
    const reader = await createUser();

    await acknowledgeKvkkNotice(actorOf(reader), "2", noMeta);
    await acknowledgeKvkkNotice(actorOf(reader), "2", noMeta);

    expect(await readEntries(reader.id)).toHaveLength(1);
  });

  it("rejects a version that is not a positive whole number", async () => {
    await twoVersions();
    const reader = await createUser();

    for (const raw of ["", "abc", "0", "1.5"]) {
      const error = await captureError(acknowledgeKvkkNotice(actorOf(reader), raw, noMeta));
      expect(error.message, raw).toBe("Geçersiz sürüm.");
    }
  });
});
