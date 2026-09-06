/**
 * Database client.
 *
 * Two drivers sit behind one Drizzle interface (see DECISIONS.md D-002):
 *  - postgres.js against a real PostgreSQL server (development, production)
 *  - PGlite, an in-process PostgreSQL, for tests that must not need Docker
 *
 * Application code only ever imports `db` and never picks a driver itself.
 */
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | null = null;
let closeHandle: (() => Promise<void>) | null = null;

function createFromEnv(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  // `max: 1` in tests keeps transaction visibility predictable; production pools normally
  const client = postgres(url, { max: process.env.NODE_ENV === "test" ? 1 : 10 });
  closeHandle = async () => {
    await client.end({ timeout: 5 });
  };
  return drizzlePostgres(client, { schema });
}

/** Replaces the active connection. Tests use this to inject a PGlite database. */
export function setDatabase(next: Database, onClose?: () => Promise<void>): void {
  instance = next;
  closeHandle = onClose ?? null;
}

export function getDatabase(): Database {
  if (!instance) instance = createFromEnv();
  return instance;
}

export async function closeDatabase(): Promise<void> {
  if (closeHandle) await closeHandle();
  instance = null;
  closeHandle = null;
}

/**
 * Ambient handle used across the app. It is a proxy so that the connection is
 * opened on first use rather than at import time, which keeps module loading
 * free of side effects.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, _receiver) {
    const target = getDatabase() as unknown as Record<string | symbol, unknown>;
    const value = target[property];
    // Bind so drizzle's internal `this` stays the real database, not the proxy
    return typeof value === "function" ? value.bind(target) : value;
  },
});
