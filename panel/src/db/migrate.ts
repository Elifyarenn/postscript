/**
 * Applies every pending migration in ./drizzle.
 * Works against both drivers; run with: pnpm db:migrate
 */
import "dotenv/config";
import path from "node:path";
import { createConnection } from "./connect";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const connection = await createConnection(url);
  const folder = path.join(process.cwd(), "drizzle");

  console.log(`Applying migrations from ${folder} ...`);
  await connection.migrate(folder);
  console.log("Migrations applied.");

  await connection.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
