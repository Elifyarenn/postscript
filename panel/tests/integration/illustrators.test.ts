/**
 * The çizer mark (D-151): an account that draws for the magazine. It is not a
 * role, so it changes nobody's panel and a writer may carry it too.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { listPublicStaff } from "@/services/public";
import { setIllustrator } from "@/services/users";
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
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

/** A public name, because the about page lists nobody without one. */
async function withPenName(userId: string, penName: string, slug: string) {
  await db.update(users).set({ penName, penNameSlug: slug }).where(eq(users.id, userId));
}

describe("setIllustrator", () => {
  it("marks an account without touching its role, and writes an audit row", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser();

    const marked = await setIllustrator(actorOf(admin), reader.id, true, noMeta);
    expect(marked.isIllustrator).toBe(true);
    // A çizer alone stays a reader: the mark hands out no panel (D-151)
    expect(marked.role).toBe("user");

    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, reader.id));
    expect(rows.map((row) => row.action)).toEqual(["user.illustrator_changed"]);

    const cleared = await setIllustrator(actorOf(admin), reader.id, false, noMeta);
    expect(cleared.isIllustrator).toBe(false);
  });

  it("lets a writer carry the mark as well", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const marked = await setIllustrator(actorOf(admin), writer.id, true, noMeta);
    expect(marked.role).toBe("writer");
    expect(marked.writerStatus).toBe("active");
    expect(marked.isIllustrator).toBe(true);
  });

  it("refuses a repeat, and anyone who is not an admin", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor", editorStatus: "active" });
    const reader = await createUser();

    await setIllustrator(actorOf(admin), reader.id, true, noMeta);
    const again = await captureError(setIllustrator(actorOf(admin), reader.id, true, noMeta));
    expect(isAppError(again) && again.status).toBe(409);

    const byEditor = await captureError(setIllustrator(actorOf(editor), reader.id, false, noMeta));
    expect(isAppError(byEditor) && byEditor.status).toBe(403);

    expect((await reloadUser(reader.id)).isIllustrator).toBe(true);
  });
});

describe("the about page's çizer list", () => {
  it("lists the marked accounts by their public name", async () => {
    const admin = await createUser({ role: "admin" });
    const drawer = await createUser({ isIllustrator: true });
    await withPenName(drawer.id, "Ada Y.", "ada-y");
    const other = await createUser({ role: "writer", writerStatus: "active", isIllustrator: true });
    await withPenName(other.id, "Bora K.", "bora-k");
    await createUser({ role: "writer", writerStatus: "active" });

    expect(await listPublicStaff("illustrator")).toEqual([
      { name: "Ada Y.", href: "/magazine/authors/ada-y" },
      { name: "Bora K.", href: "/magazine/authors/bora-k" },
    ]);
    // Being a çizer does not add anybody to the writers list
    expect((await listPublicStaff("writer")).map((member) => member.name)).toEqual(["Bora K."]);

    await setIllustrator(actorOf(admin), drawer.id, false, noMeta);
    expect((await listPublicStaff("illustrator")).map((member) => member.name)).toEqual(["Bora K."]);
  });

  it("leaves out a banned account and a suspended writer", async () => {
    const banned = await createUser({ isIllustrator: true, isBanned: true });
    await withPenName(banned.id, "Yasaklı", "yasakli");
    const suspended = await createUser({
      role: "writer",
      writerStatus: "suspended",
      isIllustrator: true,
    });
    await withPenName(suspended.id, "Askıda", "askida");

    expect(await listPublicStaff("illustrator")).toEqual([]);
  });
});
