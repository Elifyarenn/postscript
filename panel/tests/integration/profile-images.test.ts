/**
 * The member's profile picture and cover photo (D-141).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { media, users } from "@/db/schema";
import {
  clearProfileImage,
  isProfileImage,
  setProfileImage,
  MAX_PROFILE_IMAGE_BYTES,
} from "@/services/profile-images";
import { getMemberSettings, getProfile, setUsername } from "@/services/social";
import { isAppError } from "@/lib/errors";
import { getStorage, MemoryStorageAdapter } from "@/lib/storage";
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

const upload = (kind: "avatar" | "header", buffer = png(), declaredMime = "image/png") => ({
  kind,
  buffer,
  fileName: `${kind}.png`,
  declaredMime,
});

const storedKeys = () => [...(getStorage() as MemoryStorageAdapter).objects.keys()];

describe("setProfileImage (D-141)", () => {
  it("stores the picture, points the account at it and shows it on the profile", async () => {
    const member = await createUser();
    await setUsername(actorOf(member), { username: "kerem_okur" }, noMeta);

    const mediaId = await setProfileImage(actorOf(member), upload("avatar"), noMeta);

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.avatarMediaId).toBe(mediaId);

    const [file] = await db.select().from(media).where(eq(media.id, mediaId));
    expect(file?.mime).toBe("image/png");
    // The member's own picture needs no article licence
    expect(file?.licenseType).toBe("own_work");
    expect(storedKeys()).toHaveLength(1);

    const settings = await getMemberSettings(actorOf(member));
    expect(settings.avatarUrl).toBe(`/api/media/${mediaId}`);

    const profile = await getProfile(actorOf(member), "kerem_okur");
    expect(profile.avatarUrl).toBe(`/api/media/${mediaId}`);
    expect(profile.headerUrl).toBeNull();
  });

  it("keeps one picture of each kind: the replaced file leaves the library and the storage", async () => {
    const member = await createUser();
    const first = await setProfileImage(actorOf(member), upload("avatar"), noMeta);
    const second = await setProfileImage(actorOf(member), upload("avatar"), noMeta);

    expect(second).not.toBe(first);
    const [old] = await db.select().from(media).where(eq(media.id, first));
    expect(old?.deletedAt).not.toBeNull();
    expect(storedKeys()).toHaveLength(1);
  });

  it("holds the cover photo apart from the profile picture", async () => {
    const member = await createUser();
    const avatar = await setProfileImage(actorOf(member), upload("avatar"), noMeta);
    const header = await setProfileImage(actorOf(member), upload("header"), noMeta);

    const settings = await getMemberSettings(actorOf(member));
    expect(settings.avatarUrl).toBe(`/api/media/${avatar}`);
    expect(settings.headerUrl).toBe(`/api/media/${header}`);
    expect(storedKeys()).toHaveLength(2);
  });

  it("refuses a file that is not an image, one over 5 MB and a banned member", async () => {
    const member = await createUser();

    const pdf = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(32)]);
    const notImage = await setProfileImage(actorOf(member), upload("avatar", pdf, "application/pdf"), noMeta).catch(
      (error: unknown) => error,
    );
    expect(isAppError(notImage) && notImage.status).toBe(400);

    const tooBig = await setProfileImage(
      actorOf(member),
      upload("avatar", png(MAX_PROFILE_IMAGE_BYTES + 1)),
      noMeta,
    ).catch((error: unknown) => error);
    expect(isAppError(tooBig) && tooBig.status).toBe(400);

    const banned = await createUser({ isBanned: true });
    const refused = await setProfileImage(actorOf(banned), upload("avatar"), noMeta).catch(
      (error: unknown) => error,
    );
    expect(isAppError(refused) && refused.status).toBe(403);

    expect(storedKeys()).toHaveLength(0);
  });
});

describe("clearProfileImage and isProfileImage (D-141)", () => {
  it("removes the picture from the account and the storage", async () => {
    const member = await createUser();
    const mediaId = await setProfileImage(actorOf(member), upload("header"), noMeta);

    expect(await isProfileImage(mediaId)).toBe(true);

    await clearProfileImage(actorOf(member), "header", noMeta);

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.headerMediaId).toBeNull();
    expect(storedKeys()).toHaveLength(0);
    expect(await isProfileImage(mediaId)).toBe(false);
  });

  it("does nothing when there is no picture to remove", async () => {
    const member = await createUser();
    await expect(clearProfileImage(actorOf(member), "avatar", noMeta)).resolves.toBeUndefined();
  });
});
