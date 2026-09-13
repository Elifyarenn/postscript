/**
 * The admin users lists (D-087): who lands in which list, and the figures each
 * list adds for its own kind of account.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { articles, editorCategories, writerApplications, writerAreas } from "@/db/schema";
import { getUserOverview, listUsers } from "@/services/users";
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

async function seedAccounts() {
  const admin = await createUser({ role: "admin", displayName: "Admin" });
  const reader = await createUser({ displayName: "Okur" });
  const writer = await createUser({ role: "writer", writerStatus: "active", displayName: "Yazar" });
  const editor = await createUser({ role: "editor", editorStatus: "active", displayName: "Editör" });
  const hybrid = await createUser({
    role: "editor",
    editorStatus: "active",
    writerStatus: "active",
    displayName: "Editör Yazar",
  });
  return { admin, reader, writer, editor, hybrid };
}

function namesOf(rows: { displayName: string }[]): string[] {
  return rows.map((row) => row.displayName).sort();
}

/** A birth date exactly `years` ago today, so the test does not age with the calendar. */
function bornYearsAgo(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

describe("listUsers segments", () => {
  it("puts each account in its own list, and a hybrid in both staff lists", async () => {
    const { admin } = await seedAccounts();
    const actor = actorOf(admin);

    expect(namesOf(await listUsers(actor, { segment: "all" }))).toEqual(
      ["Admin", "Editör", "Editör Yazar", "Okur", "Yazar"].sort(),
    );
    expect(namesOf(await listUsers(actor, { segment: "writers" }))).toEqual(["Editör Yazar", "Yazar"]);
    expect(namesOf(await listUsers(actor, { segment: "editors" }))).toEqual(["Editör", "Editör Yazar"]);
    expect(namesOf(await listUsers(actor, { segment: "readers" }))).toEqual(["Okur"]);
  });

  it("returns no illustrators, because the role does not exist yet", async () => {
    const { admin } = await seedAccounts();
    expect(await listUsers(actorOf(admin), { segment: "illustrators" })).toEqual([]);
  });

  it("counts a writer's live articles and the published ones", async () => {
    const { admin, writer } = await seedAccounts();
    await db.insert(articles).values([
      { title: "Bir", slug: "bir", authorId: writer.id, status: "published", publishedAt: new Date() },
      { title: "İki", slug: "iki", authorId: writer.id },
      { title: "Silinen", slug: "silinen", authorId: writer.id, deletedAt: new Date() },
    ]);

    const rows = await listUsers(actorOf(admin), { segment: "writers" });
    const row = rows.find((candidate) => candidate.id === writer.id)!;
    expect(row.articleCount).toBe(2);
    expect(row.publishedCount).toBe(1);
  });

  it("lists an editor's areas in slot order and says whether 2FA is on", async () => {
    const { admin, editor } = await seedAccounts();
    const [psychology, culture] = await db
      .insert(writerAreas)
      .values([{ name: "Psikoloji" }, { name: "Kültür" }])
      .returning();
    // Inserted second slot first, so the order has to come from the query
    await db.insert(editorCategories).values([
      { editorId: editor.id, areaId: culture!.id, slot: 2 },
      { editorId: editor.id, areaId: psychology!.id, slot: 1 },
    ]);

    const rows = await listUsers(actorOf(admin), { segment: "editors" });
    const row = rows.find((candidate) => candidate.id === editor.id)!;
    expect(row.editorAreas).toEqual(["Psikoloji", "Kültür"]);
    expect(row.totpEnabled).toBe(false);
  });

  it("shows a reader's age and most recent application", async () => {
    const admin = await createUser({ role: "admin" });
    const reader = await createUser({ birthDate: bornYearsAgo(16) });
    await db.insert(writerApplications).values([
      { userId: reader.id, status: "editor_rejected", submittedAt: new Date("2026-01-01") },
      { userId: reader.id, status: "submitted", submittedAt: new Date("2026-06-01") },
    ]);

    const [row] = await listUsers(actorOf(admin), { segment: "readers" });
    expect(row!.age).toBe(16);
    expect(row!.underAge).toBe(true);
    expect(row!.applicationStatus).toBe("submitted");
    expect(row!.kvkkConsentVersion).toBe(1);
  });

  it("does not compute another list's figures", async () => {
    const { admin, writer } = await seedAccounts();
    await db.insert(articles).values({ title: "Bir", slug: "bir", authorId: writer.id });

    const rows = await listUsers(actorOf(admin), { segment: "all" });
    expect(rows.find((candidate) => candidate.id === writer.id)!.articleCount).toBe(0);
  });
});

describe("getUserOverview", () => {
  it("returns the detail page figures for one account", async () => {
    const { admin, writer } = await seedAccounts();
    await db.insert(articles).values({
      title: "Bir",
      slug: "bir",
      authorId: writer.id,
      status: "published",
      publishedAt: new Date(),
    });

    expect(await getUserOverview(actorOf(admin), writer.id)).toEqual({
      articleCount: 1,
      publishedCount: 1,
      editorAreas: [],
      applicationStatus: null,
    });
  });
});

describe("authorisation", () => {
  it("refuses the lists and the overview to anyone but an admin", async () => {
    const { editor, reader } = await seedAccounts();

    for (const call of [
      listUsers(actorOf(editor), { segment: "writers" }),
      getUserOverview(actorOf(editor), reader.id),
    ]) {
      const error = await call.then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(isAppError(error) && error.status).toBe(403);
    }
  });
});
