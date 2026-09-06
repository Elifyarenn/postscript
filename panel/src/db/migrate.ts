/**
 * Applies every pending migration in ./drizzle to the database in DATABASE_URL.
 * Run with: pnpm db:migrate
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "node:path";
import * as schema from "./schema";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  // A dedicated single connection: migrations must not share the app pool
  const client = postgres(url, { max: 1 });
  const database = drizzle(client, { schema });

  const folder = path.join(process.cwd(), "drizzle");
  console.log(`Applying migrations from ${folder} ...`);
  await migrate(database, { migrationsFolder: folder });
  console.log("Migrations applied.");

  await client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
