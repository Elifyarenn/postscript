/**
 * Who the community suggests to follow (D-139).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { follows, userBlocks, users } from "@/db/schema";
import { suggestMembers } from "@/services/posts";
import { followMember } from "@/services/social";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser } from "../helpers/factories";

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

let joined = 0;

/** A member with a handle, joining one minute after the previous one. */
async function member(username: string | null, values: { banned?: boolean } = {}) {
  joined += 1;
  const created = await createUser({ isBanned: values.banned ?? false });
  await db
    .update(users)
    .set({ username, createdAt: new Date(Date.UTC(2026, 8, 1, 0, joined)) })
    .where(eq(users.id, created.id));
  return { ...created, username };
}

describe("suggestMembers (D-139)", () => {
  it("suggests members who picked a handle, newest first, when nobody follows anybody", async () => {
    const me = await member("ben");
    await member("ilk_uye");
    await member("ikinci_uye");
    await member(null);

    const suggestions = await suggestMembers(actorOf(me));

    expect(suggestions.map((item) => item.username)).toEqual(["ikinci_uye", "ilk_uye"]);
  });

  it("leaves out the member, whoever they follow, blocked and banned accounts", async () => {
    const me = await member("ben");
    const followed = await member("takip_ettigim");
    const blocked = await member("engelledigim");
    await member("yasakli", { banned: true });
    const open = await member("acik_uye");

    await db.insert(follows).values({ followerId: me.id, followeeId: followed.id });
    await db.insert(userBlocks).values({ blockerId: me.id, blockedId: blocked.id });

    const suggestions = await suggestMembers(actorOf(me));

    expect(suggestions.map((item) => item.username)).toEqual([open.username]);
  });

  it("drops a member from the suggestions once they are followed", async () => {
    const me = await member("ben");
    await member("kerem");

    await followMember(actorOf(me), "kerem");

    expect(await suggestMembers(actorOf(me))).toEqual([]);
  });
});
