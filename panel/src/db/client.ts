/**
 * Database client.
 *
 * Two drivers sit behind one Drizzle interface (see DECISIONS.md D-002):
 *  - postgres.js against a real PostgreSQL server (development, production)
 *  - PGlite, an in-process PostgreSQL, for tests and for working without Docker
 *
 * Application code only ever imports `db` and never picks a driver itself.
 */
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type Holder = {
  instance: Database | null;
  close: (() => Promise<void>) | null;
};

/**
 * The handle lives on `globalThis` deliberately. Next.js loads
 * `instrumentation.ts` in a separate module graph from the route handlers, so a
 * plain module-level variable would give each of them its own copy and the
 * connection installed at start-up would never be seen by a request.
 */
const GLOBAL_KEY = Symbol.for("postscript.database");

function holder(): Holder {
  const globals = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Holder };
  globals[GLOBAL_KEY] ??= { instance: null, close: null };
  return globals[GLOBAL_KEY];
}

function createFromEnv(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  if (url.startsWith("pglite://")) {
    // PGlite has to be opened asynchronously, which instrumentation.ts does at
    // start-up. Reaching here means that never ran.
    throw new Error(
      "PGlite was not initialised. Check that instrumentation.ts ran before the first request.",
    );
  }

  // `max: 1` in tests keeps transaction visibility predictable; production pools normally
  const client = postgres(url, { max: process.env.NODE_ENV === "test" ? 1 : 10 });
  const state = holder();
  state.close = async () => {
    await client.end({ timeout: 5 });
  };
  return drizzlePostgres(client, { schema });
}

/** Replaces the active connection. Used by tests and by the PGlite start-up path. */
export function setDatabase(next: Database, onClose?: () => Promise<void>): void {
  const state = holder();
  state.instance = next;
  state.close = onClose ?? null;
}

export function getDatabase(): Database {
  const state = holder();
  state.instance ??= createFromEnv();
  return state.instance;
}

export async function closeDatabase(): Promise<void> {
  const state = holder();
  if (state.close) await state.close();
  state.instance = null;
  state.close = null;
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
