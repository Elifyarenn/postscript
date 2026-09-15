/**
 * Who the messages column offers a conversation with (D-143).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { blockMember, followMember, listMutualFollows, setUsername } from "@/services/social";
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
});

/** A member with a handle. */
async function member(username: string) {
  const created = await createUser();
  await setUsername(actorOf(created), { username }, noMeta);
  return created;
}

describe("listMutualFollows (D-143)", () => {
  it("lists only the members who follow back, by handle", async () => {
    const me = await member("ben");
    const mutual = await member("karsilikli");
    const iFollow = await member("takip_ettigim");
    const followsMe = await member("beni_takip_eden");

    await followMember(actorOf(me), "karsilikli");
    await followMember(actorOf(mutual), "ben");
    await followMember(actorOf(me), "takip_ettigim");
    await followMember(actorOf(followsMe), "ben");

    expect(await listMutualFollows(actorOf(me))).toEqual([
      { username: "karsilikli", penName: null, role: "user" },
    ]);
  });

  it("drops the pair when either side blocks", async () => {
    const me = await member("ben");
    const blocked = await member("engelledigim");
    const blocker = await member("beni_engelleyen");

    for (const other of ["engelledigim", "beni_engelleyen"]) {
      await followMember(actorOf(me), other);
    }
    await followMember(actorOf(blocked), "ben");
    await followMember(actorOf(blocker), "ben");

    await blockMember(actorOf(me), "engelledigim");
    await blockMember(actorOf(blocker), "ben");

    expect(await listMutualFollows(actorOf(me))).toEqual([]);
  });

  it("leaves out a banned or deleted account", async () => {
    const me = await member("ben");
    const banned = await member("yasakli");
    const gone = await member("giden");

    for (const other of ["yasakli", "giden"]) {
      await followMember(actorOf(me), other);
    }
    await followMember(actorOf(banned), "ben");
    await followMember(actorOf(gone), "ben");

    await db.update(users).set({ isBanned: true }).where(eq(users.id, banned.id));
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));

    expect(await listMutualFollows(actorOf(me))).toEqual([]);
  });
});
