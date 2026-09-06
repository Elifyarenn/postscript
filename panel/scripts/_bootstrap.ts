/**
 * Shared start-up for the command line scripts: loads .env, opens the database
 * connection the URL asks for, and installs it as the ambient one so the
 * services behave exactly as they do inside the application.
 */
import "dotenv/config";
import { createConnection, type Connection } from "@/db/connect";
import { setDatabase } from "@/db/client";

export async function bootstrap(): Promise<Connection> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const connection = await createConnection(url);
  setDatabase(connection.db, connection.close);
  return connection;
}

/** Wraps a script body so every one of them reports failures the same way. */
export function runScript(body: (connection: Connection) => Promise<void>): void {
  bootstrap()
    .then(async (connection) => {
      await body(connection);
      await connection.close();
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
