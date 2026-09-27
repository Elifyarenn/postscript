/**
 * The main editor's contact list (D-267): who may open it, and that it holds
 * the team and nobody else.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { users } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { listTeamContacts } from "@/services/team-contacts";
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

async function mainEditor() {
  const editor = await createUser({ role: "editor", editorStatus: "active" });
  await db.update(users).set({ isMainEditor: true }).where(eq(users.id, editor.id));
  return editor;
}

describe("listTeamContacts", () => {
  it("refuses a category editor and a writer", async () => {
    const categoryEditor = await createUser({ role: "editor", editorStatus: "active" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    for (const actor of [categoryEditor, writer]) {
      const error = await listTeamContacts(actorOf(actor)).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(isAppError(error) && error.status).toBe(403);
    }
  });

  it("lists the team with their numbers, and leaves readers and banned accounts out", async () => {
    const editor = await mainEditor();
    const writer = await createUser({ role: "writer", writerStatus: "active", displayName: "Ada" });
    await db.update(users).set({ phone: "05321234567" }).where(eq(users.id, writer.id));
    const illustrator = await createUser({ isIllustrator: true, displayName: "Çizer" });
    const reader = await createUser({ displayName: "Okur" });
    const banned = await createUser({ role: "writer", isBanned: true });

    const ids = (await listTeamContacts(actorOf(editor))).map((row) => row.id);
    expect(ids).toContain(writer.id);
    expect(ids).toContain(illustrator.id);
    expect(ids).not.toContain(reader.id);
    expect(ids).not.toContain(banned.id);

    const [found] = await listTeamContacts(actorOf(editor), { query: "Ada" });
    expect(found?.phone).toBe("05321234567");
    // Only what a call needs leaves the service
    expect(found).not.toHaveProperty("email");
    expect(found).not.toHaveProperty("birthDate");
  });

  it("opens for an admin as well", async () => {
    const admin = await createUser({ role: "admin" });
    await expect(listTeamContacts(actorOf(admin))).resolves.toBeInstanceOf(Array);
  });
});
