import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CRON_SECRET_MIN_LENGTH, isCronRequestAuthorised } from "@/lib/cron";

const SECRET = "s".repeat(CRON_SECRET_MIN_LENGTH);

describe("isCronRequestAuthorised", () => {
  it("accepts the bearer token Vercel sends", () => {
    expect(isCronRequestAuthorised(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("stays closed when the secret is not configured", () => {
    // Otherwise "Bearer undefined" or an empty header could open the endpoint
    expect(isCronRequestAuthorised("Bearer undefined", undefined)).toBe(false);
    expect(isCronRequestAuthorised("Bearer ", "")).toBe(false);
  });

  it("stays closed when the secret is too short", () => {
    const weak = "s".repeat(CRON_SECRET_MIN_LENGTH - 1);
    expect(isCronRequestAuthorised(`Bearer ${weak}`, weak)).toBe(false);
  });

  it("rejects a missing, wrong or unprefixed header", () => {
    expect(isCronRequestAuthorised(null, SECRET)).toBe(false);
    expect(isCronRequestAuthorised(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isCronRequestAuthorised(SECRET, SECRET)).toBe(false);
  });
});

describe("vercel.json cron schedule", () => {
  const config = JSON.parse(readFileSync(path.resolve("vercel.json"), "utf8")) as {
    crons: { path: string; schedule: string }[];
  };

  it("points every cron at a route that exists", () => {
    for (const cron of config.crons) {
      expect(existsSync(path.resolve("src/app", `.${cron.path}`, "route.ts")), cron.path).toBe(true);
    }
  });

  it("runs at most once a day, which the Hobby plan requires", () => {
    // A deploy with a more frequent expression fails on Hobby, taking the whole release down
    for (const cron of config.crons) {
      const [minute, hour] = cron.schedule.split(" ");
      expect(minute, cron.schedule).toMatch(/^\d+$/);
      expect(hour, cron.schedule).toMatch(/^\d+$/);
    }
  });
});
