/**
 * The pen name, edited from the community settings (D-144).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { getMemberSettings, setPenName } from "@/services/social";
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

describe("setPenName (D-144)", () => {
  it("saves the pen name with the address its author page uses", async () => {
    const member = await createUser();

    expect(await setPenName(actorOf(member), { penName: "  Zeynep K.  " })).toBe("Zeynep K.");

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.penName).toBe("Zeynep K.");
    expect(row?.penNameSlug).toBe("zeynep-k");
    expect((await getMemberSettings(actorOf(member))).penName).toBe("Zeynep K.");
  });

  it("clears the pen name when it is left empty", async () => {
    const member = await createUser();
    await setPenName(actorOf(member), { penName: "Silinecek" });

    expect(await setPenName(actorOf(member), { penName: "  " })).toBeNull();

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.penName).toBeNull();
    expect(row?.penNameSlug).toBeNull();
  });

  it("refuses a pen name another member already uses", async () => {
    const first = await createUser();
    const second = await createUser();
    await setPenName(actorOf(first), { penName: "Zeynep K." });

    const clash = await setPenName(actorOf(second), { penName: "zeynep k" }).catch((error: unknown) => error);
    expect(isAppError(clash) && clash.status).toBe(409);
  });

  it("refuses a name with no letters, and a banned member", async () => {
    const member = await createUser();
    const punctuation = await setPenName(actorOf(member), { penName: "!!!" }).catch((error: unknown) => error);
    expect(isAppError(punctuation) && punctuation.status).toBe(400);

    const banned = await createUser({ isBanned: true });
    const refused = await setPenName(actorOf(banned), { penName: "Yasak" }).catch((error: unknown) => error);
    expect(isAppError(refused) && refused.status).toBe(403);
  });
});
