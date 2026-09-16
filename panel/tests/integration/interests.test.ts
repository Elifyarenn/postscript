/**
 * Interest chips on the community settings (D-149).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type Database } from "@/db/client";
import { isAppError } from "@/lib/errors";
import { getMemberSettings, setInterests, setUsername } from "@/services/social";
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

async function member() {
  const user = await createUser({ role: "user" });
  const actor = actorOf(user);
  // Nothing social works without a handle (D-089), and interests are social
  await setUsername(actor, { username: "okur_uye" }, noMeta);
  return actor;
}

describe("setInterests (D-149)", () => {
  it("keeps what the member picked, in the list's own order", async () => {
    const actor = await member();
    await setInterests(actor, { interests: ["muzik", "sanat"] });

    const settings = await getMemberSettings(actor);
    expect(settings.interests).toEqual(["sanat", "muzik"]);
  });

  it("clears the row when nothing is picked", async () => {
    const actor = await member();
    await setInterests(actor, { interests: ["kitap"] });
    await setInterests(actor, { interests: [] });

    expect((await getMemberSettings(actor)).interests).toEqual([]);
  });

  it("refuses something that is not on the list, and more than five", async () => {
    const actor = await member();

    const strange = await setInterests(actor, { interests: ["kripto"] }).catch((e: unknown) => e);
    expect(isAppError(strange) && strange.status).toBe(400);

    const tooMany = await setInterests(actor, {
      interests: ["sanat", "edebiyat", "muzik", "film", "dizi", "kitap"],
    }).catch((e: unknown) => e);
    expect(isAppError(tooMany) && tooMany.status).toBe(400);

    expect((await getMemberSettings(actor)).interests).toEqual([]);
  });

  it("counts a repeated choice once", async () => {
    const actor = await member();
    await setInterests(actor, { interests: ["moda", "moda", "moda"] });
    expect((await getMemberSettings(actor)).interests).toEqual(["moda"]);
  });
});
