/**
 * Driver selection (DECISIONS.md D-002).
 *
 * `DATABASE_URL` decides which driver is used:
 *   postgres://…  a real PostgreSQL server (docker compose, production)
 *   pglite://<dir> an in-process PostgreSQL stored in <dir>, for working
 *                  without Docker and for the end to end tests
 *
 * Both come back as the same Drizzle interface, so nothing else in the
 * application knows or cares which one is live.
 */
import "server-only";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./client";

export type Connection = {
  db: Database;
  close: () => Promise<void>;
  /** Applies migrations with the migrator that matches the driver. */
  migrate: (folder: string) => Promise<void>;
};

export function isPgliteUrl(url: string): boolean {
  return url.startsWith("pglite://");
}

/** Strips the scheme and returns the directory PGlite should store data in. */
export function pgliteDataDir(url: string): string {
  return url.replace(/^pglite:\/\//, "") || ".pglite";
}

export async function createConnection(url: string): Promise<Connection> {
  if (isPgliteUrl(url)) {
    // Imported lazily so the WASM build is never pulled into a server bundle
    // that talks to a real PostgreSQL
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const { mkdir } = await import("node:fs/promises");

    // PGlite creates only the leaf directory, so any parents have to exist
    const directory = pgliteDataDir(url);
    await mkdir(directory, { recursive: true });

    const client = new PGlite(directory);
    const db = drizzle(client, { schema }) as unknown as Database;

    return {
      db,
      close: () => client.close(),
      migrate: (folder) => migrate(db as never, { migrationsFolder: folder }),
    };
  }

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const client = postgres(url, { max: 1 });
  const db = drizzlePostgres(client, { schema });

  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
    migrate: (folder) => migrate(db, { migrationsFolder: folder }),
  };
}
