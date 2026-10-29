/**
 * Drawings a çizer hands in from their panel (D-362): who may upload, which
 * files pass, who sees them, and what removing one keeps.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, illustrations, issues, notifications, users, writerAreas } from "@/db/schema";
import {
  listIllustrationsForReview,
  listOwnIllustrations,
  pruneRemovedIllustrations,
  readIllustrationFile,
  removeIllustration,
  setIllustrationArea,
  uploadIllustration,
} from "@/services/illustrations";
import { MAX_ILLUSTRATION_BYTES } from "@/lib/illustration";
import { anonymiseUser, exportUserData } from "@/services/users";
import { isAppError } from "@/lib/errors";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, testIssueId } from "../helpers/factories";
import type { User } from "@/db/schema";

let database: Database;
const storage = new MemoryStorageAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setStorageAdapter(storage);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  storage.clear();
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

/** The first bytes of a PNG with its size in the header, padded to `length`. */
function png(width: number, height: number, length = 64): Buffer {
  const header = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, length - header.length))]);
}

async function illustrator(overrides: Parameters<typeof createUser>[0] = {}): Promise<User> {
  const user = await createUser({ displayName: "Çizer Ece", ...overrides });
  await db.update(users).set({ isIllustrator: true }).where(eq(users.id, user.id));
  return user;
}

async function upload(user: User, options: { buffer?: Buffer; mime?: string; title?: string; issueId?: string | null } = {}) {
  return uploadIllustration(
    actorOf(user),
    {
      buffer: options.buffer ?? png(1200, 800),
      declaredMime: options.mime ?? "image/png",
      fileName: "kapak.png",
      fields: {
        title: options.title ?? "Kapak taslağı",
        note: "Sayı 2 kapağı için.",
        // Every drawing names its issue (D-372)
        issueId: options.issueId === undefined ? await testIssueId() : options.issueId,
      },
    },
    noMeta,
  );
}

describe("handing a drawing in", () => {
  it("stores the file and the record, with its size, hash and audit row", async () => {
    const ece = await illustrator();
    const buffer = png(1200, 800);
    const row = await upload(ece, { buffer, issueId: await testIssueId() });

    expect(row.illustratorId).toBe(ece.id);
    expect(row.mime).toBe("image/png");
    expect(row.width).toBe(1200);
    expect(row.height).toBe(800);
    expect(row.sha256).toBe(createHash("sha256").update(buffer).digest("hex"));
    expect(row.storageKey.startsWith("illustrations/")).toBe(true);
    expect(storage.objects.has(`media:${row.storageKey}`)).toBe(true);

    const [audit] = await db.select().from(auditLog).where(eq(auditLog.entityId, row.id));
    expect(audit?.action).toBe("illustration.uploaded");
    expect(audit?.ip).toBe(noMeta.ip);
  });

  it("refuses an account without the çizer mark, and an unverified or banned çizer", async () => {
    const reader = await createUser();
    expect((await captureError(upload(reader))).status).toBe(403);

    const unverified = await illustrator({ emailVerified: false });
    expect((await captureError(upload(unverified))).status).toBe(403);

    const banned = await illustrator();
    await db.update(users).set({ isBanned: true }).where(eq(users.id, banned.id));
    expect((await captureError(upload({ ...banned, isBanned: true }))).status).toBe(403);

    expect(await db.select().from(illustrations)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  it("refuses a PDF, a GIF, a disguised file and one over the limit", async () => {
    const ece = await illustrator();
    const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(40)]);
    expect((await captureError(upload(ece, { buffer: pdf, mime: "application/pdf" }))).status).toBe(400);
    const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(40)]);
    expect((await captureError(upload(ece, { buffer: gif, mime: "image/gif" }))).status).toBe(400);
    expect((await captureError(upload(ece, { mime: "image/jpeg" }))).message).toContain("uyuşmuyor");
    const big = png(5000, 5000, MAX_ILLUSTRATION_BYTES + 1);
    expect((await captureError(upload(ece, { buffer: big }))).message).toContain("çok büyük");

    expect(storage.objects.size).toBe(0);
  });

  it("refuses a missing title, a missing issue and the admins' sample; a published issue is fine", async () => {
    const ece = await illustrator();
    expect((await captureError(upload(ece, { title: "  " }))).status).toBe(400);
    expect((await captureError(upload(ece, { issueId: null }))).status).toBe(400);

    // Its drawings still need their licence (D-372)
    const [published] = await db
      .insert(issues)
      .values({ number: 1, title: "Yayımlanmış", status: "published" })
      .returning({ id: issues.id });
    expect((await upload(ece, { issueId: published!.id })).issueId).toBe(published!.id);

    const [sample] = await db
      .insert(issues)
      .values({ number: 2, title: "Örnek", status: "planning", adminOnly: true })
      .returning({ id: issues.id });
    expect((await captureError(upload(ece, { issueId: sample!.id }))).status).toBe(400);
  });

  it("tells the admins in the panel, not the main editor or a category editor (D-372)", async () => {
    const admin = await createUser({ role: "admin" });
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const plain = await createUser({ role: "editor", editorStatus: "active" });
    const ece = await illustrator();

    await upload(ece);

    const told = await db.select().from(notifications).where(eq(notifications.kind, "illustration_uploaded"));
    expect(told.map((row) => row.userId)).toEqual([admin.id]);
    expect(told.some((row) => row.userId === plain.id || row.userId === main.id)).toBe(false);
    expect(told[0]?.href).toBe("/admin/cizimler");
  });
});

describe("who sees a drawing", () => {
  it("shows it to its çizer and the admins; 404 for everyone else, the main editor too (D-372)", async () => {
    const ece = await illustrator();
    const other = await illustrator({ displayName: "Çizer Mert" });
    const admin = await createUser({ role: "admin" });
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const plain = await createUser({ role: "editor", editorStatus: "active" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const row = await upload(ece);

    for (const allowed of [ece, admin]) {
      const file = await readIllustrationFile(actorOf(allowed), row.id);
      expect(file.mime).toBe("image/png");
    }
    for (const refused of [other, main, plain, writer]) {
      expect((await captureError(readIllustrationFile(actorOf(refused), row.id))).status).toBe(404);
    }

    expect((await listOwnIllustrations(actorOf(ece))).map((item) => item.id)).toEqual([row.id]);
    expect(await listOwnIllustrations(actorOf(other))).toEqual([]);
    expect((await listIllustrationsForReview(actorOf(admin))).map((item) => item.illustratorName)).toEqual(["Çizer Ece"]);
    for (const refused of [main, plain]) {
      expect((await captureError(listIllustrationsForReview(actorOf(refused)))).status).toBe(403);
    }
  });
});

describe("filing a drawing under a category (D-381)", () => {
  it("lets an admin set and clear it by the area's id, with an audit row; the file and title stay", async () => {
    const admin = await createUser({ role: "admin" });
    const ece = await illustrator();
    const row = await upload(ece);
    const [area] = await db.insert(writerAreas).values({ name: "Sanat", sortOrder: 1 }).returning();

    await setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: area!.id }, noMeta);
    const [listed] = await listIllustrationsForReview(actorOf(admin));
    expect(listed?.areaId).toBe(area!.id);
    expect(listed?.areaName).toBe("Sanat");
    expect(listed?.title).toBe("Kapak taslağı");

    // Saving the same choice again writes nothing
    await setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: area!.id }, noMeta);
    await setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: "" }, noMeta);
    const [after] = await db.select().from(illustrations).where(eq(illustrations.id, row.id));
    expect(after?.areaId).toBeNull();
    expect(after?.sha256).toBe(row.sha256);

    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, row.id), eq(auditLog.action, "illustration.area_set")));
    expect(audits).toHaveLength(2);
  });

  it("refuses the çizer, the main editor, an unknown area and a removed drawing", async () => {
    const admin = await createUser({ role: "admin" });
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const ece = await illustrator();
    const row = await upload(ece);
    const [area] = await db.insert(writerAreas).values({ name: "Tarih", sortOrder: 1 }).returning();

    for (const refused of [ece, main]) {
      const error = await captureError(setIllustrationArea(actorOf(refused), { illustrationId: row.id, areaId: area!.id }, noMeta));
      expect(error.status).toBe(403);
    }
    const unknown = await captureError(
      setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: "00000000-0000-4000-8000-000000000000" }, noMeta),
    );
    expect(unknown.status).toBe(400);
    const notUuid = await captureError(setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: "Sanat" }, noMeta));
    expect(notUuid.status).toBe(400);

    await removeIllustration(actorOf(admin), row.id, noMeta);
    const removed = await captureError(setIllustrationArea(actorOf(admin), { illustrationId: row.id, areaId: area!.id }, noMeta));
    expect(removed.status).toBe(404);
  });
});

describe("taking a drawing back", () => {
  it("lets the çizer remove their own: the file goes, the record and its audit row stay", async () => {
    const ece = await illustrator();
    const row = await upload(ece);

    await removeIllustration(actorOf(ece), row.id, noMeta);

    expect(storage.objects.has(`media:${row.storageKey}`)).toBe(false);
    const [kept] = await db.select().from(illustrations).where(eq(illustrations.id, row.id));
    expect(kept?.deletedAt).toBeInstanceOf(Date);
    expect(kept?.deletedBy).toBe(ece.id);
    expect(kept?.sha256).toBe(row.sha256);
    expect(await listOwnIllustrations(actorOf(ece))).toEqual([]);
    expect((await captureError(readIllustrationFile(actorOf(ece), row.id))).status).toBe(404);

    const removed = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, row.id), eq(auditLog.action, "illustration.removed")));
    expect(removed).toHaveLength(1);

    // A second removal finds nothing
    expect((await captureError(removeIllustration(actorOf(ece), row.id, noMeta))).status).toBe(404);
  });

  it("lets an admin remove anyone's, but not the main editor or another çizer", async () => {
    const ece = await illustrator();
    const other = await illustrator();
    const main = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ isMainEditor: true }).where(eq(users.id, main.id));
    const admin = await createUser({ role: "admin" });
    const row = await upload(ece);

    expect((await captureError(removeIllustration(actorOf(other), row.id, noMeta))).status).toBe(404);
    expect((await captureError(removeIllustration(actorOf(main), row.id, noMeta))).status).toBe(404);

    await removeIllustration(actorOf(admin), row.id, noMeta);
    const [kept] = await db.select().from(illustrations).where(eq(illustrations.id, row.id));
    expect(kept?.deletedBy).toBe(admin.id);
  });
});

describe("the çizer's own data (KVKK)", () => {
  it("lists the drawings in the data export, without the storage key", async () => {
    const ece = await illustrator();
    const row = await upload(ece);

    const exported = await exportUserData(actorOf(ece), ece.id);
    expect(exported.illustrations.map((item) => item.id)).toEqual([row.id]);
    expect(exported.illustrations[0]).not.toHaveProperty("storageKey");
  });

  it("deletes the files when the account is deleted, keeping the record", async () => {
    const ece = await illustrator();
    const first = await upload(ece, { title: "Bir" });
    const second = await upload(ece, { title: "İki" });

    await anonymiseUser(ece.id);

    expect(storage.objects.has(`media:${first.storageKey}`)).toBe(false);
    expect(storage.objects.has(`media:${second.storageKey}`)).toBe(false);
    const kept = await db.select().from(illustrations).where(eq(illustrations.illustratorId, ece.id));
    expect(kept).toHaveLength(2);
    expect(kept.every((item) => item.deletedAt instanceof Date)).toBe(true);
  });
});

describe("the record of a removed drawing", () => {
  it("is kept for a year after the removal, then deleted; a held drawing is never touched", async () => {
    const ece = await illustrator();
    const removed = await upload(ece, { title: "Kaldırılan" });
    const held = await upload(ece, { title: "Duran" });
    await removeIllustration(actorOf(ece), removed.id, noMeta);

    const inElevenMonths = new Date(Date.now() + 330 * 86_400_000);
    expect(await pruneRemovedIllustrations(inElevenMonths)).toBe(0);

    const inThirteenMonths = new Date(Date.now() + 395 * 86_400_000);
    expect(await pruneRemovedIllustrations(inThirteenMonths)).toBe(1);
    const left = await db.select({ id: illustrations.id }).from(illustrations);
    expect(left.map((row) => row.id)).toEqual([held.id]);
  });
});
