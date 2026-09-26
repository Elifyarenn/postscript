/**
 * The move of every existing article into issue 1 (D-261, migrations 0048 and
 * 0049), run the way production will run it: a database at 0047 with
 * articles that have no issue, then the new migrations on top.
 */
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "drizzle");
const BACKFILL_TAG = "0048_issue_one_backfill";

let client: PGlite | null = null;
let folder: string | null = null;

afterEach(async () => {
  await client?.close();
  client = null;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = null;
});

/** A copy of the migrations folder whose journal stops before the backfill. */
function migrationsBefore(tag: string): string {
  folder = mkdtempSync(path.join(tmpdir(), "ps-migrations-"));
  cpSync(SOURCE, folder, { recursive: true });
  const journalPath = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { tag: string }[] };
  const cut = journal.entries.findIndex((entry) => entry.tag === tag);
  expect(cut).toBeGreaterThan(0);
  journal.entries = journal.entries.slice(0, cut);
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

async function databaseAt0047() {
  client = new PGlite();
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: migrationsBefore(BACKFILL_TAG) });
  return database;
}

const STAMP = "2026-09-20T10:00:00.000Z";

async function insertLegacyArticles() {
  await client!.query(
    `insert into articles (title, slug, status, updated_at, deleted_at) values
       ('İncelemede', 'incelemede', 'in_review', $1, null),
       ('Ana editörde', 'ana-editorde', 'pending_admin_approval', $1, null),
       ('Silinmiş', 'silinmis', 'draft', $1, $1)`,
    [STAMP],
  );
}

async function rows<T>(sql: string): Promise<T[]> {
  return (await client!.query<T>(sql)).rows;
}

describe("moving existing articles into issue 1", () => {
  it("creates issue 1 when there is none and attaches every article, nothing else changed", async () => {
    const database = await databaseAt0047();
    await insertLegacyArticles();

    await migrate(database, { migrationsFolder: SOURCE });

    const issueRows = await rows<{ id: string; number: number; title: string }>(
      "select id, number, title from issues",
    );
    expect(issueRows).toEqual([expect.objectContaining({ number: 1, title: "Sayı 1" })]);

    const articleRows = await rows<{ slug: string; status: string; issue_id: string; updated_at: Date }>(
      "select slug, status, issue_id, updated_at from articles order by slug",
    );
    expect(articleRows).toHaveLength(3);
    for (const row of articleRows) {
      expect(row.issue_id).toBe(issueRows[0]!.id);
      expect(new Date(row.updated_at).toISOString()).toBe(STAMP);
    }
    expect(articleRows.map((row) => row.status)).toEqual(["pending_admin_approval", "in_review", "draft"]);

    // The column is required from now on
    await expect(
      client!.query("insert into articles (title, slug) values ('Sayısız', 'sayisiz')"),
    ).rejects.toThrow();
  });

  it("uses the issue 1 that already exists, as on the live site", async () => {
    const database = await databaseAt0047();
    const [existing] = await rows<{ id: string }>(
      "insert into issues (number, title, status, admin_only) values (1, 'Obsession', 'planning', true) returning id",
    );
    await insertLegacyArticles();

    await migrate(database, { migrationsFolder: SOURCE });

    const issueRows = await rows<{ id: string; title: string; admin_only: boolean }>(
      "select id, title, admin_only from issues",
    );
    expect(issueRows).toEqual([{ id: existing!.id, title: "Obsession", admin_only: true }]);
    const unattached = await rows("select 1 from articles where issue_id is distinct from '" + existing!.id + "'");
    expect(unattached).toHaveLength(0);
  });

  it("can run twice without making a second issue or touching anything", async () => {
    const database = await databaseAt0047();
    await insertLegacyArticles();
    await migrate(database, { migrationsFolder: SOURCE });

    const backfill = readFileSync(path.join(SOURCE, `${BACKFILL_TAG}.sql`), "utf8");
    for (const statement of backfill.split("--> statement-breakpoint")) {
      await client!.query(statement);
    }

    expect(await rows("select 1 from issues")).toHaveLength(1);
    expect(await rows("select 1 from articles where issue_id is null")).toHaveLength(0);
  });

  it("does nothing on an empty database", async () => {
    const database = await databaseAt0047();
    await migrate(database, { migrationsFolder: SOURCE });
    expect(await rows("select 1 from issues")).toHaveLength(0);
  });
});
