/**
 * Writer promotion (§6). The rule that a person under 18 can never become a
 * writer is checked here against the database, not only in the age unit test.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { auditLog, roleChanges, sessions } from "@/db/schema";
import {
  changeRole,
  checkWriterEligibility,
  deleteUserAsAdmin,
  promoteToWriter,
  setBanned,
  setWriterStatus,
} from "@/services/users";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract, reloadUser } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
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

/** An 18th birthday that is still one day away, computed from today. */
function birthDateForAge(years: number, offsetDays = 0): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe("eligibility", () => {
  it("passes a verified adult with consent", async () => {
    const candidate = await createUser();
    expect(checkWriterEligibility(candidate).eligible).toBe(true);
  });

  it("lists every missing prerequisite at once", async () => {
    const candidate = await createUser({
      emailVerified: false,
      birthDate: null,
    });

    const result = checkWriterEligibility(candidate);
    expect(result.eligible).toBe(false);
    expect(result.problems).toEqual(["email_not_verified", "birth_date_missing"]);
  });
});

describe("promoteToWriter", () => {
  /** An admin, with the publisher details and a published contract in place. */
  async function adminWithContract() {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    return admin;
  }

  it("promotes an eligible user and records the role change", async () => {
    const admin = await adminWithContract();
    const candidate = await createUser();

    const promoted = await promoteToWriter(actorOf(admin), candidate.id, noMeta);

    expect(promoted.role).toBe("writer");
    expect(promoted.writerStatus).toBe("active");

    const changes = await db.select().from(roleChanges).where(eq(roleChanges.userId, candidate.id));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      oldRole: "user",
      newRole: "writer",
      changedBy: admin.id,
    });

    expect(mailbox.lastTo(candidate.email)?.subject).toContain("Yazar");
  });

  it("refuses a seventeen year old and says why", async () => {
    const admin = await adminWithContract();
    // One day short of the eighteenth birthday
    const minor = await createUser({ birthDate: birthDateForAge(18, 1) });

    const error = await captureError(promoteToWriter(actorOf(admin), minor.id, noMeta));

    expect(error.status).toBe(409);
    expect(error.details?.requirements).toContain("Kullanıcı 18 yaşından küçük.");

    const unchanged = await reloadUser(minor.id);
    expect(unchanged.role).toBe("user");
    expect(unchanged.writerStatus).toBeNull();

    const changes = await db.select().from(roleChanges).where(eq(roleChanges.userId, minor.id));
    expect(changes).toHaveLength(0);
  });

  it("accepts someone who turned eighteen today", async () => {
    const admin = await adminWithContract();
    const justAdult = await createUser({ birthDate: birthDateForAge(18) });

    const promoted = await promoteToWriter(actorOf(admin), justAdult.id, noMeta);
    expect(promoted.role).toBe("writer");
  });

  it("promotes without a published contract (D-050)", async () => {
    const admin = await createUser({ role: "admin" });
    const candidate = await createUser();

    const promoted = await promoteToWriter(actorOf(admin), candidate.id, noMeta);
    expect(promoted.role).toBe("writer");
    expect(promoted.writerStatus).toBe("active");
  });

  it("refuses when the writer has no birth date, and names that placeholder", async () => {
    const admin = await adminWithContract();

    const candidate = await createUser({ birthDate: null });
    const error = await captureError(promoteToWriter(actorOf(admin), candidate.id, noMeta));

    expect(error.details?.requirements).toContain("Doğum tarihi girilmemiş.");
  });

  it("refuses a banned user", async () => {
    const admin = await adminWithContract();
    const candidate = await createUser({ isBanned: true });

    const error = await captureError(promoteToWriter(actorOf(admin), candidate.id, noMeta));
    expect(error.details?.requirements).toContain("Kullanıcı yasaklı.");
  });

  it("does not let an editor promote anyone", async () => {
    const editor = await createUser({ role: "editor" });
    const candidate = await createUser();

    const error = await captureError(promoteToWriter(actorOf(editor), candidate.id, noMeta));
    expect(error.status).toBe(403);
  });
});

describe("suspension and demotion", () => {
  it("suspends a writer without touching their role", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const suspended = await setWriterStatus(actorOf(admin), writer.id, "suspended", noMeta);
    expect(suspended.role).toBe("writer");
    expect(suspended.writerStatus).toBe("suspended");
  });

  it("clears writer_status when the role goes back to user", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const demoted = await changeRole(actorOf(admin), writer.id, "user", noMeta);
    expect(demoted.role).toBe("user");
    expect(demoted.writerStatus).toBeNull();

    const changes = await db.select().from(roleChanges).where(eq(roleChanges.userId, writer.id));
    expect(changes).toHaveLength(1);
  });

  it("stops an admin changing their own role", async () => {
    const admin = await createUser({ role: "admin" });
    const error = await captureError(changeRole(actorOf(admin), admin.id, "user", noMeta));
    expect(error.status).toBe(400);
  });

  it("requires a reason when banning", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser();

    const error = await captureError(setBanned(actorOf(admin), target.id, true, "", noMeta));
    expect(error.status).toBe(400);

    const banned = await setBanned(actorOf(admin), target.id, true, "Spam", noMeta);
    expect(banned.isBanned).toBe(true);
    expect(banned.bannedReason).toBe("Spam");
  });
});

describe("admin deletes a user", () => {
  it("anonymises, soft deletes and revokes the sessions", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser({ role: "writer", writerStatus: "active" });

    // A live session: deletion must kill it with the account
    await db.insert(sessions).values({
      userId: target.id,
      tokenHash: "deleted-session-test",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await deleteUserAsAdmin(actorOf(admin), target.id, "İstek üzerine", noMeta);

    const deleted = await reloadUser(target.id);
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.anonymizedAt).not.toBeNull();
    expect(deleted.email).toBe(`deleted+${target.id}@invalid.local`);
    expect(deleted.displayName).toBe("Silinmiş kullanıcı");
    expect(deleted.passwordHash).toBe("disabled");

    const remainingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, target.id));
    expect(remainingSessions).toHaveLength(1);
    expect(remainingSessions[0]!.revokedAt).not.toBeNull();

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.deleted_by_admin"));
    expect(audit).toHaveLength(1);
    expect(audit[0]!.actorId).toBe(admin.id);
    expect(audit[0]!.ip).toBe(noMeta.ip);
    expect(audit[0]!.after).toMatchObject({ deleted: true, reason: "İstek üzerine" });
  });

  it("refuses a non-admin actor", async () => {
    const editor = await createUser({ role: "editor" });
    const target = await createUser();

    const error = await captureError(deleteUserAsAdmin(actorOf(editor), target.id, "Neden", noMeta));
    expect(error.status).toBe(403);
  });

  it("refuses deleting yourself", async () => {
    const admin = await createUser({ role: "admin" });

    const error = await captureError(deleteUserAsAdmin(actorOf(admin), admin.id, "Neden", noMeta));
    expect(error.status).toBe(400);
  });

  it("requires a reason", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser();

    const error = await captureError(deleteUserAsAdmin(actorOf(admin), target.id, "   ", noMeta));
    expect(error.status).toBe(400);

    const intact = await reloadUser(target.id);
    expect(intact.deletedAt).toBeNull();
  });

  it("refuses a user that was already deleted", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser();
    await deleteUserAsAdmin(actorOf(admin), target.id, "İlk silme", noMeta);

    const error = await captureError(deleteUserAsAdmin(actorOf(admin), target.id, "İkinci silme", noMeta));
    expect(error.status).toBe(404);
  });
});
