/**
 * In-process PostgreSQL for tests (DECISIONS.md D-002).
 *
 * PGlite runs the real PostgreSQL engine compiled to WebAssembly, so the same
 * migrations, enums, partial indexes and triggers are exercised as in
 * production — without needing Docker on the developer's machine.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import * as schema from "@/db/schema";
import { closeDatabase, setDatabase, type Database } from "@/db/client";

let client: PGlite | null = null;

/** Creates the database and applies every migration. Call once per test file. */
export async function setupTestDatabase(): Promise<Database> {
  client = new PGlite();
  const database = drizzle(client, { schema }) as unknown as Database;

  await migrate(database as never, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  setDatabase(database, async () => {
    await client?.close();
    client = null;
  });

  return database;
}

export async function teardownTestDatabase(): Promise<void> {
  await closeDatabase();
}

/**
 * Empties every table between tests. `audit_log` and `role_changes` carry a
 * DELETE-blocking trigger, so the trigger is disabled for the truncate and put
 * straight back afterwards.
 */
export async function resetTables(database: Database): Promise<void> {
  await database.execute(sql`
    do $$
    declare
      target record;
      table_list text;
    begin
      -- ALTER TABLE takes one table at a time, so triggers are toggled in a loop
      for target in
        select tablename from pg_tables
         where schemaname = 'public' and tablename <> '__drizzle_migrations'
      loop
        execute format('alter table public.%I disable trigger all', target.tablename);
      end loop;

      -- TRUNCATE, on the other hand, wants them all at once to satisfy the FKs
      select string_agg(format('public.%I', tablename), ', ')
        into table_list
        from pg_tables
       where schemaname = 'public' and tablename <> '__drizzle_migrations';

      if table_list is not null then
        execute 'truncate table ' || table_list || ' restart identity cascade';
      end if;

      for target in
        select tablename from pg_tables
         where schemaname = 'public' and tablename <> '__drizzle_migrations'
      loop
        execute format('alter table public.%I enable trigger all', target.tablename);
      end loop;
    end $$;
  `);
}
