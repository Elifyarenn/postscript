/**
 * Team avatars end to end against the database (D-194, D-195): who may save, that
 * the PNG really is a transparent square PNG, that saving again replaces the
 * record and its file, and that deletion and account anonymisation leave
 * nothing behind.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, teamAvatars } from "@/db/schema";
import { AVATAR_CONFIG_VERSION, DEFAULT_AVATAR_CONFIG } from "@/lib/avatar/registry";
import { isAppError } from "@/lib/errors";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import {
  deleteOwnTeamAvatar,
  deleteTeamAvatarAsAdmin,
  getOwnTeamAvatar,
  getTeamAvatarPng,
  listTeamAvatars,
  saveTeamAvatar,
  teamAvatarZipEntries,
} from "@/services/team-avatars";
import { anonymiseUser } from "@/services/users";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

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

const input = (overrides: Record<string, unknown> = {}) => ({
  displayName: "Elif Yaren Çekiç",
  teamRole: "Genel Yayın Yönetmeni",
  config: DEFAULT_AVATAR_CONFIG,
  ...overrides,
});

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(isAppError(error) && error.status).toBe(status);
}

describe("saveTeamAvatar", () => {
  it("stores the configuration and a transparent 2048px PNG", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await saveTeamAvatar(actorOf(writer), input(), noMeta);

    const rows = await db.select().from(teamAvatars);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(writer.id);
    expect(rows[0]!.config).toEqual(DEFAULT_AVATAR_CONFIG);

    const png = storage.objects.get(`media:${rows[0]!.pngStorageKey}`)!;
    expect(png.mime).toBe("image/png");
    expect(png.body.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.body.readUInt32BE(16)).toBe(2048);
    expect(png.body.readUInt32BE(20)).toBe(2048);
    // Colour type 6 is RGBA: the image carries an alpha channel
    expect(png.body[25]).toBe(6);
  }, 60_000);

  it("replaces the member's avatar and its file instead of adding a second", async () => {
    const illustrator = await createUser({ isIllustrator: true });
    await saveTeamAvatar(actorOf(illustrator), input(), noMeta);
    const [first] = await db.select().from(teamAvatars);

    await saveTeamAvatar(
      actorOf(illustrator),
      input({ teamRole: "Çizer", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "volume" } }),
      noMeta,
    );
    const rows = await db.select().from(teamAvatars);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first!.id);
    expect(rows[0]!.teamRole).toBe("Çizer");
    expect(storage.objects.has(`media:${first!.pngStorageKey}`)).toBe(false);
    expect(storage.objects.size).toBe(1);

    const own = await getOwnTeamAvatar(actorOf(illustrator));
    expect(own?.config.hairStyle).toBe("volume");

    const actions = await db.select({ action: auditLog.action, entityId: auditLog.entityId }).from(auditLog);
    expect(actions.map((entry) => entry.action)).toEqual(["team_avatar.created", "team_avatar.updated"]);
    expect(actions.every((entry) => entry.entityId === first!.id)).toBe(true);
  }, 60_000);

  it("refuses a plain reader", async () => {
    const reader = await createUser();
    await expectStatus(saveTeamAvatar(actorOf(reader), input(), noMeta), 403);
    expect(await db.select().from(teamAvatars)).toHaveLength(0);
  });

  it("refuses a configuration outside the catalogue before drawing anything", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "active" });
    await expectStatus(
      saveTeamAvatar(actorOf(editor), input({ config: { ...DEFAULT_AVATAR_CONFIG, clothing: "<script>" } }), noMeta),
      400,
    );
    await expectStatus(saveTeamAvatar(actorOf(editor), input({ displayName: "" }), noMeta), 400);
    expect(storage.objects.size).toBe(0);
  });
});

describe("admin access", () => {
  it("lists, downloads and zips for an admin only", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await saveTeamAvatar(actorOf(writer), input(), noMeta);

    const list = await listTeamAvatars(actorOf(admin));
    expect(list).toHaveLength(1);
    expect(list[0]!.fileName).toBe("elif-yaren-cekic-avatar.png");
    expect(list[0]!.user.id).toBe(writer.id);

    const png = await getTeamAvatarPng(actorOf(admin), list[0]!.id);
    expect(png.fileName).toBe("elif-yaren-cekic-avatar.png");
    expect(png.body.subarray(1, 4).toString("ascii")).toBe("PNG");

    const zip = await teamAvatarZipEntries(actorOf(admin), null);
    const names: string[] = [];
    for await (const entry of zip.entries) names.push(entry.name);
    expect(names).toEqual(["elif-yaren-cekic-avatar.png"]);

    await expectStatus(listTeamAvatars(actorOf(writer)), 403);
    await expectStatus(getTeamAvatarPng(actorOf(writer), list[0]!.id), 403);
    await expectStatus(teamAvatarZipEntries(actorOf(writer), null), 403);
  }, 60_000);

  it("draws the PNG again when the stored file is gone", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await saveTeamAvatar(actorOf(writer), input(), noMeta);
    storage.clear();

    const [row] = await db.select().from(teamAvatars);
    const png = await getTeamAvatarPng(actorOf(admin), row!.id);
    expect(png.body.readUInt32BE(16)).toBe(2048);
    const [after] = await db.select().from(teamAvatars).where(eq(teamAvatars.id, row!.id));
    expect(storage.objects.has(`media:${after!.pngStorageKey}`)).toBe(true);
  }, 60_000);
});

describe("records saved in the first style (D-194)", () => {
  it("are redrawn in the current style, with their choices carried over, when downloaded", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await saveTeamAvatar(actorOf(writer), input(), noMeta);
    const [row] = await db.select().from(teamAvatars);
    // Turn the fresh record into one saved before the redesign
    await db
      .update(teamAvatars)
      .set({ configVersion: 1, config: { v: 1, faceShape: "square", hairStyle: "afro", hairTexture: "coily", top: "blazer" } })
      .where(eq(teamAvatars.id, row!.id));

    await getTeamAvatarPng(actorOf(admin), row!.id);
    const [after] = await db.select().from(teamAvatars).where(eq(teamAvatars.id, row!.id));
    expect(after!.configVersion).toBe(AVATAR_CONFIG_VERSION);
    expect(after!.config).toMatchObject({ face: "softSquare", hairStyle: "volume", hairTexture: "coily", clothing: "blazer" });
    expect(after!.pngStorageKey).not.toBe(row!.pngStorageKey);
    expect(storage.objects.has(`media:${row!.pngStorageKey}`)).toBe(false);
  }, 60_000);
});

describe("deletion", () => {
  it("removes the record and the file for the member and for an admin", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const illustrator = await createUser({ isIllustrator: true, displayName: "Çizer" });

    await saveTeamAvatar(actorOf(writer), input(), noMeta);
    await deleteOwnTeamAvatar(actorOf(writer), noMeta);
    expect(await db.select().from(teamAvatars)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);

    await saveTeamAvatar(actorOf(illustrator), input({ displayName: "Ada" }), noMeta);
    const [row] = await db.select().from(teamAvatars);
    await expectStatus(deleteTeamAvatarAsAdmin(actorOf(illustrator), row!.id, noMeta), 403);
    await deleteTeamAvatarAsAdmin(actorOf(admin), row!.id, noMeta);
    expect(await db.select().from(teamAvatars)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  }, 60_000);

  it("goes with the account when it is anonymised", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await saveTeamAvatar(actorOf(writer), input(), noMeta);
    await anonymiseUser(writer.id);
    expect(await db.select().from(teamAvatars)).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  }, 60_000);
});
