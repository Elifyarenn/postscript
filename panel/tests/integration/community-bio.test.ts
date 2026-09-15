/**
 * The community profile's bio, edited from the community settings (D-136).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMemberSettings, setBio } from "@/services/social";
import { isAppError } from "@/lib/errors";
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

describe("setBio (D-136)", () => {
  it("saves the bio alone and leaves the rest of the profile as it was", async () => {
    const member = await createUser({ displayName: "Gerçek Ad" });
    await db.update(users).set({ penName: "Mahlas" }).where(eq(users.id, member.id));

    expect(await setBio(actorOf(member), { bio: "  Kitap kurdu.  " })).toBe("Kitap kurdu.");

    expect((await getMemberSettings(actorOf(member))).bio).toBe("Kitap kurdu.");
    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.displayName).toBe("Gerçek Ad");
    expect(row?.penName).toBe("Mahlas");
  });

  it("clears the bio when it is left empty", async () => {
    const member = await createUser();
    await setBio(actorOf(member), { bio: "Bir şey" });

    expect(await setBio(actorOf(member), { bio: "   " })).toBeNull();
    expect((await getMemberSettings(actorOf(member))).bio).toBeNull();
  });

  it("refuses a bio longer than 2000 characters and unexpected fields", async () => {
    const member = await createUser();

    const tooLong = await setBio(actorOf(member), { bio: "a".repeat(2001) }).catch((error: unknown) => error);
    expect(isAppError(tooLong) && tooLong.status).toBe(400);

    const extra = await setBio(actorOf(member), { bio: "x", displayName: "Başka" }).catch((error: unknown) => error);
    expect(isAppError(extra) && extra.status).toBe(400);
  });

  it("does not let a banned member change it", async () => {
    const member = await createUser({ isBanned: true });

    const refused = await setBio(actorOf(member), { bio: "x" }).catch((error: unknown) => error);
    expect(isAppError(refused) && refused.status).toBe(403);
  });
});
