/**
 * The pen name: its rules (D-144), and the account page as the place it is
 * changed since it left the edit-profile dialog (D-162).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { getMemberSettings, setPenName } from "@/services/social";
import { updateProfile } from "@/services/users";
import { isAppError } from "@/lib/errors";
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

describe("the account form keeps the pen name rules (D-162)", () => {
  it("saves the pen name with its address", async () => {
    const member = await createUser();

    await updateProfile(actorOf(member), { displayName: member.displayName, penName: " Zeynep K. " }, noMeta);

    const [row] = await db.select().from(users).where(eq(users.id, member.id));
    expect(row?.penName).toBe("Zeynep K.");
    expect(row?.penNameSlug).toBe("zeynep-k");
  });

  it("refuses a pen name another member uses, and one with no letters", async () => {
    const first = await createUser();
    await setPenName(actorOf(first), { penName: "Zeynep K." });
    const second = await createUser();

    const clash = await updateProfile(
      actorOf(second),
      { displayName: second.displayName, penName: "zeynep k" },
      noMeta,
    ).catch((error: unknown) => error);
    expect(isAppError(clash) && clash.status).toBe(409);
    expect(isAppError(clash) && clash.details?.penName).toEqual(["Bu mahlas alınmış."]);

    const punctuation = await updateProfile(
      actorOf(second),
      { displayName: second.displayName, penName: "!!!" },
      noMeta,
    ).catch((error: unknown) => error);
    expect(isAppError(punctuation) && punctuation.status).toBe(400);

    const [row] = await db.select().from(users).where(eq(users.id, second.id));
    expect(row?.penName).toBeNull();
  });

  it("does not let an old pen name that breaks today's rule block an unrelated change", async () => {
    const member = await createUser();
    // Saved before the account form checked anything
    await db.update(users).set({ penName: "!!!", penNameSlug: null }).where(eq(users.id, member.id));

    const updated = await updateProfile(actorOf(member), { displayName: "Yeni Ad", penName: "!!!" }, noMeta);
    expect(updated.displayName).toBe("Yeni Ad");
  });
});
