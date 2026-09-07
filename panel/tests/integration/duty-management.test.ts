/**
 * Duty management (§ of the role-and-account module): an admin can freeze or
 * reactivate an editor's duty, and writers/editors can freeze their own duty
 * from the account page. Every freeze keeps the role and the legal records;
 * only the panel access changes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { setEditorStatus, selfFreezeDuty } from "@/services/users";
import { listMedia } from "@/services/media";
import { canAccessEditorPanel, canAccessRestrictedWriterPages } from "@/lib/auth/rbac";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser } from "../helpers/factories";

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

describe("admin freezes an editor's duty", () => {
  it("locks the editor panel without touching the role", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });

    const updated = await setEditorStatus(actorOf(admin), editor.id, "suspended", noMeta);
    expect(updated.editorStatus).toBe("suspended");
    expect(updated.role).toBe("editor");

    // The panel access closes…
    expect(canAccessEditorPanel(actorOf(updated))).toBe(false);
    // …and an editor-only service refuses the frozen editor outright
    const refused = await captureError(listMedia(actorOf(updated), 10));
    expect(refused.status).toBe(403);
  });

  it("reopens the panel when the admin reactivates the duty", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor", editorStatus: "suspended" });

    const updated = await setEditorStatus(actorOf(admin), editor.id, "active", noMeta);
    expect(updated.editorStatus).toBe("active");
    expect(canAccessEditorPanel(actorOf(updated))).toBe(true);
  });

  it("refuses a non-admin, and refuses to freeze a non-editor", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const writer = await createUser({ role: "writer" });

    const notAdmin = await captureError(
      setEditorStatus(actorOf(editor), editor.id, "suspended", noMeta),
    );
    expect(notAdmin.status).toBe(403);

    const notEditor = await captureError(
      setEditorStatus(actorOf(admin), writer.id, "suspended", noMeta),
    );
    expect(notEditor.status).toBe(409);
  });
});

describe("a user freezes their own duty", () => {
  it("lets an editor freeze themself", async () => {
    const editor = await createUser({ role: "editor" });

    const updated = await selfFreezeDuty(actorOf(editor), noMeta);
    expect(updated.editorStatus).toBe("suspended");
    expect(updated.role).toBe("editor");
    expect(canAccessEditorPanel(actorOf(updated))).toBe(false);
  });

  it("lets a writer freeze themself and locks the inner pages", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    const updated = await selfFreezeDuty(actorOf(writer), noMeta);
    expect(updated.writerStatus).toBe("suspended");
    expect(canAccessRestrictedWriterPages(actorOf(updated))).toBe(false);
  });

  it("refuses a plain user, who has no duty to freeze", async () => {
    const reader = await createUser({ role: "user" });

    const error = await captureError(selfFreezeDuty(actorOf(reader), noMeta));
    expect(error.status).toBe(409);
  });

  it("refuses an admin, whose duty is not frozen this way", async () => {
    const admin = await createUser({ role: "admin" });

    const error = await captureError(selfFreezeDuty(actorOf(admin), noMeta));
    expect(error.status).toBe(409);
  });

  it("is idempotent for an already frozen duty", async () => {
    const editor = await createUser({ role: "editor", editorStatus: "suspended" });

    const again = await selfFreezeDuty(actorOf(editor), noMeta);
    expect(again.editorStatus).toBe("suspended");
  });

  it("keeps the account data intact: only the duty state changes", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active", displayName: "Kayitli Yazar" });

    await selfFreezeDuty(actorOf(writer), noMeta);
    const after = await reloadUser(writer.id);
    expect(after.displayName).toBe("Kayitli Yazar");
    expect(after.role).toBe("writer");
    expect(after.deletionRequestedAt).toBeNull();
  });
});