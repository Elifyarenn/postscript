/**
 * A session cookie that opens nothing any more (D-365): told apart from a
 * working one, deleted on request, and a working one never touched.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { sessions } from "@/db/schema";
import { clearStaleSessionCookie, createSession, hasStaleSessionCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { clearStaleSessionAction } from "@/app/(auth)/actions";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser, noMeta } from "../helpers/factories";

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

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  jar.cookies.clear();
  jar.headers = new Headers();
});

async function signedIn() {
  const user = await createUser();
  await createSession({ userId: user.id, ip: noMeta.ip, userAgent: noMeta.userAgent });
  const [session] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
  return session!;
}

describe("a session cookie that opens nothing (D-365)", () => {
  it("leaves a visitor without the cookie alone", async () => {
    expect(await hasStaleSessionCookie()).toBe(false);
    expect(await clearStaleSessionCookie()).toBe(false);
  });

  it("never deletes a working session's cookie", async () => {
    await signedIn();
    expect(await hasStaleSessionCookie()).toBe(false);
    expect(await clearStaleSessionCookie()).toBe(false);
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(true);
  });

  it("deletes the cookie of a session signed out elsewhere", async () => {
    const session = await signedIn();
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));

    expect(await hasStaleSessionCookie()).toBe(true);
    expect(await clearStaleSessionCookie()).toBe(true);
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("deletes the cookie of a session idle past the limit", async () => {
    const session = await signedIn();
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000);
    await db.update(sessions).set({ lastSeenAt: eightDaysAgo }).where(eq(sessions.id, session.id));

    expect(await hasStaleSessionCookie()).toBe(true);
    expect(await clearStaleSessionCookie()).toBe(true);
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("deletes a cookie that matches no session at all", async () => {
    jar.cookies.set(SESSION_COOKIE, "bilinmeyen-bir-deger");
    expect(await hasStaleSessionCookie()).toBe(true);
    expect(await clearStaleSessionCookie()).toBe(true);
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
  });

  it("keeps the cookie when the action's token does not match", async () => {
    jar.cookies.set(SESSION_COOKIE, "bilinmeyen-bir-deger");
    jar.cookies.set("ps_csrf", "dogru-token");
    await clearStaleSessionAction("yanlis-token");
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(true);
  });
});
