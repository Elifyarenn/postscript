/**
 * The team memberships export (D-302): admin only, the team and its former
 * members, and nothing but names, duties and dates.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, users } from "@/db/schema";
import { recordRoleChange, writeAudit } from "@/lib/audit";
import { isAppError } from "@/lib/errors";
import { exportTeamMemberships } from "@/services/team-memberships";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser } from "../helpers/factories";

let database: Database;
const meta = { ip: null };

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

describe("exportTeamMemberships", () => {
  it("refuses everyone but an admin", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "active" });
    const error = await exportTeamMemberships(actorOf(editor), meta).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(isAppError(error) && error.status).toBe(403);
  });

  it("lists current and former members with their periods and nothing else", async () => {
    const admin = await createUser({ role: "admin", displayName: "Yönetici" });
    const writer = await createUser({ role: "writer", writerStatus: "active", displayName: "Ada" });
    await db.update(users).set({ phone: "05321234567", penName: "Kedyumi" }).where(eq(users.id, writer.id));
    await recordRoleChange({ userId: writer.id, oldRole: "user", newRole: "writer", changedBy: admin.id });

    const former = await createUser({ displayName: "Eski" });
    await recordRoleChange({ userId: former.id, oldRole: "user", newRole: "writer", changedBy: admin.id });
    await recordRoleChange({ userId: former.id, oldRole: "writer", newRole: "user", changedBy: admin.id });

    const illustrator = await createUser({ isIllustrator: true, displayName: "Çizer" });
    await writeAudit({
      actorId: admin.id,
      action: "user.illustrator_changed",
      entityType: "users",
      entityId: illustrator.id,
      before: { isIllustrator: false },
      after: { isIllustrator: true },
    });

    const reader = await createUser({ displayName: "Okur" });
    const banned = await createUser({ role: "writer", isBanned: true });

    const result = await exportTeamMemberships(actorOf(admin), meta);
    const byId = new Map(result.members.map((member) => [member.id, member]));

    expect(byId.has(reader.id)).toBe(false);
    expect(byId.has(banned.id)).toBe(false);

    const ada = byId.get(writer.id)!;
    expect(ada.penName).toBe("Kedyumi");
    expect(ada.memberships).toHaveLength(1);
    expect(ada.memberships[0]).toMatchObject({ duty: "writer", endedAt: null });
    expect(ada.memberships[0]!.startedAt).not.toBeNull();
    // Only the name, pen name and periods leave the panel
    expect(Object.keys(ada).sort()).toEqual(["id", "memberships", "name", "penName"]);
    expect(JSON.stringify(result)).not.toContain("05321234567");
    expect(JSON.stringify(result)).not.toContain("@example.com");

    expect(byId.get(former.id)!.memberships[0]!.endedAt).not.toBeNull();
    expect(byId.get(illustrator.id)!.memberships).toMatchObject([{ duty: "illustrator", endedAt: null }]);
    // The seeded-style admin has no role record: held, start unknown
    expect(byId.get(admin.id)!.memberships).toEqual([{ duty: "admin", startedAt: null, endedAt: null }]);

    const [trace] = await db.select().from(auditLog).where(eq(auditLog.action, "team_memberships.exported"));
    expect(trace?.actorId).toBe(admin.id);
  });
});
