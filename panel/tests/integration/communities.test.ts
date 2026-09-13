/**
 * Communities (D-093).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { communityMemberships } from "@/db/schema";
import {
  archiveCommunity,
  createCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunities,
} from "@/services/communities";
import { createPost, listCommunityPosts, listHomeFeed } from "@/services/posts";
import { setUsername } from "@/services/social";
import { anonymiseUser } from "@/services/users";
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

async function member(username: string) {
  const user = await createUser();
  await setUsername(actorOf(user), { username }, noMeta);
  return reloadUser(user.id);
}

describe("opening communities", () => {
  it("lets only an admin open one, with a unique slug", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser();

    expect((await captureError(createCommunity(actorOf(reader), { name: "Şiir" }, noMeta))).status).toBe(403);

    const created = await createCommunity(actorOf(admin), { name: "Şiir Atölyesi", description: "dizeler" }, noMeta);
    expect(created.slug).toBe("siir-atolyesi");

    const again = await captureError(createCommunity(actorOf(admin), { name: "şiir atölyesi" }, noMeta));
    expect(again.status).toBe(409);
  });
});

describe("membership and posting", () => {
  it("joins with a handle, counts members and lets them go", async () => {
    const admin = await createUser({ role: "admin" });
    await createCommunity(actorOf(admin), { name: "Sinema" }, noMeta);
    const lunae = await member("lunae");
    const noHandle = await createUser();

    expect((await captureError(joinCommunity(actorOf(noHandle), "sinema"))).status).toBe(409);

    await joinCommunity(actorOf(lunae), "sinema");
    await joinCommunity(actorOf(lunae), "sinema");

    const [listed] = await listCommunities(actorOf(lunae));
    expect(listed!.memberCount).toBe(1);
    expect(listed!.isMember).toBe(true);

    await leaveCommunity(actorOf(lunae), "sinema");
    expect((await getCommunity(actorOf(lunae), "sinema")).memberCount).toBe(0);
  });

  it("takes posts only from members, shows them on the community and in the author's feed", async () => {
    const admin = await createUser({ role: "admin" });
    const community = await createCommunity(actorOf(admin), { name: "Kitaplar" }, noMeta);
    const lunae = await member("lunae");

    const refused = await captureError(
      createPost(actorOf(lunae), { body: "üye değilim", communityId: community.id }, noMeta),
    );
    expect(refused.status).toBe(403);

    await joinCommunity(actorOf(lunae), "kitaplar");
    const created = await createPost(actorOf(lunae), { body: "okuduğum kitap", communityId: community.id }, noMeta);

    const posts = await listCommunityPosts(actorOf(lunae), community.id);
    expect(posts.map((post) => post.id)).toEqual([created.id]);
    expect(posts[0]!.community).toEqual({ slug: "kitaplar", name: "Kitaplar" });

    const feed = await listHomeFeed(actorOf(lunae));
    expect(feed[0]!.community?.slug).toBe("kitaplar");
  });

  it("closes an archived community to new members and posts", async () => {
    const admin = await createUser({ role: "admin" });
    const community = await createCommunity(actorOf(admin), { name: "Eski" }, noMeta);
    const lunae = await member("lunae");
    await joinCommunity(actorOf(lunae), "eski");

    await archiveCommunity(actorOf(admin), community.id, noMeta);

    expect(await listCommunities(actorOf(lunae))).toHaveLength(0);
    expect((await getCommunity(actorOf(lunae), "eski")).archived).toBe(true);
    const newcomer = await member("yeni");
    expect((await captureError(joinCommunity(actorOf(newcomer), "eski"))).status).toBe(409);
    expect(
      (await captureError(createPost(actorOf(lunae), { body: "geç kaldım", communityId: community.id }, noMeta))).status,
    ).toBe(409);
  });

  it("drops an anonymised member's memberships", async () => {
    const admin = await createUser({ role: "admin" });
    await createCommunity(actorOf(admin), { name: "Müzik" }, noMeta);
    const lunae = await member("lunae");
    await joinCommunity(actorOf(lunae), "muzik");

    await anonymiseUser(lunae.id);
    expect(await db.select().from(communityMemberships)).toHaveLength(0);
  });
});
