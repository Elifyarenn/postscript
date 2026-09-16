/**
 * The profile edited in one dialog with one save, as X does it (D-160).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, media, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { MAX_PROFILE_IMAGE_BYTES } from "@/lib/profile-limits";
import { getStorage, MemoryStorageAdapter } from "@/lib/storage";
import { updateProfile, type PictureChange, type ProfileEdit } from "@/services/profile-edit";
import { setProfileImage } from "@/services/profile-images";
import { getMemberSettings, getProfile, setPenName, setUsername } from "@/services/social";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  (getStorage() as MemoryStorageAdapter).clear();
});

/** A real PNG header, padded to the given size. */
function png(size = 64): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length))]);
}

const KEEP: PictureChange = { action: "keep" };

const replace = (buffer = png(), declaredMime = "image/png"): PictureChange => ({
  action: "replace",
  buffer,
  fileName: "photo.png",
  declaredMime,
});

const edit = (overrides: Partial<ProfileEdit> = {}): ProfileEdit => ({
  penName: "",
  bio: "",
  avatar: KEEP,
  header: KEEP,
  ...overrides,
});

const storage = () => getStorage() as MemoryStorageAdapter;

async function rowOf(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row!;
}

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  if (!isAppError(error)) throw new Error(`expected an AppError, got ${String(error)}`);
  return error;
}

describe("updateProfile (D-160)", () => {
  it("saves the pen name, the bio and both pictures in one call", async () => {
    const member = await createUser();
    await setUsername(actorOf(member), { username: "kerem_okur" }, noMeta);

    await updateProfile(
      actorOf(member),
      edit({ penName: "  Kerem  ", bio: "  Kitap kurdu.  ", avatar: replace(), header: replace() }),
      noMeta,
    );

    const profile = await getProfile(actorOf(member), "kerem_okur");
    expect(profile.penName).toBe("Kerem");
    expect(profile.bio).toBe("Kitap kurdu.");
    expect(profile.avatarUrl).toMatch(/^\/api\/media\//);
    expect(profile.headerUrl).toMatch(/^\/api\/media\//);
    expect(profile.avatarUrl).not.toBe(profile.headerUrl);

    const row = await rowOf(member.id);
    expect(row.penNameSlug).toBe("kerem");
    expect(storage().objects.size).toBe(2);
  });

  it("writes nothing when one field is wrong, and reports every problem at once", async () => {
    const other = await createUser();
    await setPenName(actorOf(other), { penName: "Kerem" });

    const member = await createUser();
    await updateProfile(actorOf(member), edit({ penName: "Eski", bio: "Eski bio" }), noMeta);

    const pdf = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(32)]);
    const error = await failure(
      updateProfile(
        actorOf(member),
        edit({
          penName: "Kerem",
          bio: "Yeni bio",
          avatar: replace(),
          header: replace(pdf, "application/pdf"),
        }),
        noMeta,
      ),
    );

    expect(error.status).toBe(400);
    expect(Object.keys(error.details ?? {}).sort()).toEqual(["headerImage", "penName"]);

    // The valid bio and the valid avatar were not saved either
    const row = await rowOf(member.id);
    expect(row.penName).toBe("Eski");
    expect(row.bio).toBe("Eski bio");
    expect(row.avatarMediaId).toBeNull();
    expect(storage().objects.size).toBe(0);
    expect(await db.select().from(media)).toHaveLength(0);
  });

  it("answers 409 when the only problem is a pen name another member holds", async () => {
    const other = await createUser();
    await setPenName(actorOf(other), { penName: "Kerem" });
    const member = await createUser();

    const error = await failure(updateProfile(actorOf(member), edit({ penName: "kerem" }), noMeta));
    expect(error.status).toBe(409);
  });

  it("refuses text over the limits and a picture over 5 MB", async () => {
    const member = await createUser();

    const error = await failure(
      updateProfile(
        actorOf(member),
        edit({ penName: "a".repeat(81), bio: "b".repeat(2001), avatar: replace(png(MAX_PROFILE_IMAGE_BYTES + 1)) }),
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(Object.keys(error.details ?? {}).sort()).toEqual(["avatarImage", "bio", "penName"]);
    expect(storage().objects.size).toBe(0);
  });

  it("replaces one picture, removes the other and discards both old files only after saving", async () => {
    const member = await createUser();
    const oldAvatar = await setProfileImage(
      actorOf(member),
      { kind: "avatar", buffer: png(), fileName: "a.png", declaredMime: "image/png" },
      noMeta,
    );
    const oldHeader = await setProfileImage(
      actorOf(member),
      { kind: "header", buffer: png(), fileName: "h.png", declaredMime: "image/png" },
      noMeta,
    );

    await updateProfile(actorOf(member), edit({ avatar: replace(), header: { action: "remove" } }), noMeta);

    const row = await rowOf(member.id);
    expect(row.avatarMediaId).not.toBeNull();
    expect(row.avatarMediaId).not.toBe(oldAvatar);
    expect(row.headerMediaId).toBeNull();

    for (const id of [oldAvatar, oldHeader]) {
      const [old] = await db.select().from(media).where(eq(media.id, id));
      expect(old?.deletedAt).not.toBeNull();
    }
    // Only the new avatar is left in storage
    expect(storage().objects.size).toBe(1);

    const actions = (await db.select().from(auditLog)).map((entry) => entry.action);
    expect(actions.filter((action) => action === "user.profile_image_cleared")).toHaveLength(1);
  });

  it("keeps the pictures when they are left alone, and clears empty text", async () => {
    const member = await createUser();
    await updateProfile(actorOf(member), edit({ penName: "Mahlas", bio: "Bir şey", avatar: replace() }), noMeta);
    const { avatarUrl } = await getMemberSettings(actorOf(member));

    await updateProfile(actorOf(member), edit({ penName: "   ", bio: "" }), noMeta);

    const settings = await getMemberSettings(actorOf(member));
    expect(settings.penName).toBeNull();
    expect(settings.bio).toBeNull();
    expect(settings.avatarUrl).toBe(avatarUrl);
    expect((await rowOf(member.id)).penNameSlug).toBeNull();
  });

  it("takes back the files it stored when the save fails halfway", async () => {
    const member = await createUser();
    const adapter = storage();
    const originalPut = adapter.put.bind(adapter);
    let calls = 0;
    adapter.put = async (object) => {
      calls += 1;
      if (calls === 2) throw new Error("storage went away");
      return originalPut(object);
    };

    try {
      await expect(
        updateProfile(actorOf(member), edit({ bio: "Yeni", avatar: replace(), header: replace() }), noMeta),
      ).rejects.toThrow("storage went away");
    } finally {
      adapter.put = originalPut;
    }

    expect(adapter.objects.size).toBe(0);
    expect((await rowOf(member.id)).bio).toBeNull();
  });

  it("does not let a banned member edit", async () => {
    const banned = await createUser({ isBanned: true });
    const error = await failure(updateProfile(actorOf(banned), edit({ bio: "x", avatar: replace() }), noMeta));
    expect(error.status).toBe(403);
    expect(storage().objects.size).toBe(0);
  });
});
