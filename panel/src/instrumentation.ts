/**
 * Runs once when the server starts.
 *
 * Its only job is the Docker-free development path: when `DATABASE_URL` points
 * at PGlite, the connection has to be opened asynchronously before the first
 * request, because the WASM engine cannot be loaded from a synchronous getter.
 * With an ordinary postgres:// URL this does nothing and the pool opens lazily.
 */
export async function register(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("pglite://")) return;

  // Only the Node runtime can host PGlite; the edge runtime never sees it
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { createConnection } = await import("@/db/connect");
  const { setDatabase } = await import("@/db/client");

  const connection = await createConnection(url);
  setDatabase(connection.db, connection.close);

  console.log(`[postscript] in-process PostgreSQL ready (${url})`);
}
