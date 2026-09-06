/**
 * Starts the application for the end to end run.
 *
 * Wipes the previous run's data directory, seeds a fresh database, and then
 * hands over to `next dev`. Doing it here rather than in a shell script keeps
 * the suite runnable on Windows and Linux alike.
 */
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const DATA_DIR = ".e2e";

async function main(): Promise<void> {
  console.log("[e2e] clearing previous run data ...");
  await rm(path.join(process.cwd(), DATA_DIR), { recursive: true, force: true });

  console.log("[e2e] seeding ...");
  await run("pnpm", ["exec", "tsx", "--tsconfig", "scripts/tsconfig.json", "scripts/seed.ts"]);

  // A production build, not `next dev`: the development server renders its own
  // error shell instead of forbidden.tsx, and the suite asserts on that page
  console.log("[e2e] building ...");
  await run("pnpm", ["exec", "next", "build"]);

  console.log("[e2e] starting the server ...");
  const port = process.env.PORT ?? "3101";
  await run("pnpm", ["exec", "next", "start", "-p", port]);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
