/**
 * Which files the media route lets the viewer's browser keep (D-363): a
 * profile picture or cover photo, whose bytes never change under one id, for
 * 30 days and only in that browser; everything else never.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users, type User } from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { setProfileImage } from "@/services/profile-images";
import { uploadMedia } from "@/services/media";
import { GET as getMediaRoute } from "@/app/api/media/[id]/route";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser } from "../helpers/factories";

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () => jar.headers,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

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
  jar.cookies.clear();
  jar.headers = new Headers();
});

async function signIn(user: User): Promise<void> {
  jar.cookies.clear();
  await createSession({ userId: user.id, ip: noMeta.ip, userAgent: noMeta.userAgent });
}

function png(size = 64): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length))]);
}

function fetchMedia(id: string): Promise<Response> {
  return getMediaRoute(new Request(`http://localhost:3001/api/media/${id}`), { params: Promise.resolve({ id }) });
}

const avatarOf = (user: User) =>
  setProfileImage(actorOf(user), { kind: "avatar", buffer: png(), fileName: "a.png", declaredMime: "image/png" }, noMeta);

describe("caching what the media route serves (D-363)", () => {
  it("lets another member's browser keep a profile picture for 30 days, privately", async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const avatar = await avatarOf(owner);

    await signIn(viewer);
    const response = await fetchMedia(avatar);

    expect(response.status).toBe(200);
    const cache = response.headers.get("cache-control") ?? "";
    expect(cache).toContain("private");
    expect(cache).toContain("max-age=2592000");
    expect(cache).toContain("immutable");
    expect(cache).not.toContain("public");
  });

  it("gives a replaced picture a new address and stops serving the old one", async () => {
    const owner = await createUser();
    const first = await avatarOf(owner);
    const second = await avatarOf(owner);

    expect(second).not.toBe(first);
    await signIn(await createUser());
    expect((await fetchMedia(first)).status).toBe(404);
    expect((await fetchMedia(second)).status).toBe(200);
  });

  it("still serves a picture to signed-in members only", async () => {
    const avatar = await avatarOf(await createUser());
    expect((await fetchMedia(avatar)).status).toBe(401);
  });

  it("keeps library media out of every cache", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "active" });
    await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, editor.id));
    const row = await uploadMedia(
      actorOf(await reloadUser(editor.id)),
      { buffer: png(), fileName: "g.png", declaredMime: "image/png", license: { licenseType: "own_work" } },
      noMeta,
    );

    await signIn(await reloadUser(editor.id));
    const response = await fetchMedia(row.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
