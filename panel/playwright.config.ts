import { defineConfig, devices } from "@playwright/test";

/**
 * End to end configuration (§13.2).
 *
 * The suite drives a real server against an in-process PostgreSQL and a
 * file-backed mail and storage adapter, so it needs neither Docker nor a mail
 * server. `pnpm test:e2e` prepares a fresh database before starting.
 */
const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Each scenario owns its data, so they must not interleave in one database
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "tr-TR",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // A dedicated data directory, wiped and re-seeded before the run
    command: "pnpm exec tsx --tsconfig scripts/tsconfig.json tests/e2e/serve.ts",
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      APP_URL: BASE_URL,
      DATABASE_URL: "pglite://.e2e/db",
      S3_ENDPOINT: "file://.e2e/storage",
      MAIL_TRANSPORT: "file",
      MAIL_DIR: ".e2e/mail",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
    },
  },
});
