/**
 * The "Yetkili" mark (D-295): it replaced the legal adviser and assistant
 * marks, started empty, and is the admin's to set. It is not a role.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { listUsers, setAuthorized } from "@/services/users";
import { isTeamMember } from "@/services/team-avatars";
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

describe("the Yetkili mark", () => {
  it("starts empty: an old legal adviser or assistant mark does not carry over", async () => {
    const old = await createUser({ role: "user" });
    await db.update(users).set({ isLegalAdvisor: true, isAssistant: true }).where(eq(users.id, old.id));
    expect((await reloadUser(old.id)).isAuthorized).toBe(false);
    // The old marks open nothing any more
    expect(await isTeamMember(actorOf(await reloadUser(old.id)))).toBe(false);
  });

  it("is set and cleared by an admin, recorded, and leaves the role alone", async () => {
    const admin = await createUser({ role: "admin" });
    const member = await createUser({ role: "user" });

    await setAuthorized(actorOf(admin), member.id, true, noMeta);
    const marked = await reloadUser(member.id);
    expect(marked.isAuthorized).toBe(true);
    expect(marked.role).toBe("user");
    expect(await isTeamMember(actorOf(marked))).toBe(true);
    expect((await listUsers(actorOf(admin), { segment: "authorized" })).map((row) => row.id)).toContain(member.id);

    const again = await setAuthorized(actorOf(admin), member.id, true, noMeta).catch((error) => error);
    expect(isAppError(again) && again.status).toBe(409);

    await setAuthorized(actorOf(admin), member.id, false, noMeta);
    expect((await reloadUser(member.id)).isAuthorized).toBe(false);
    expect(await db.select().from(auditLog).where(eq(auditLog.action, "user.authorized_changed"))).toHaveLength(2);
  });

  it("is the admin's alone", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "active" });
    const member = await createUser({ role: "user" });
    const attempt = await setAuthorized(actorOf(editor), member.id, true, noMeta).catch((error) => error);
    expect(isAppError(attempt) && attempt.status).toBe(403);
    expect((await reloadUser(member.id)).isAuthorized).toBe(false);
  });
});
