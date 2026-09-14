/**
 * The bot check on the forms that send e-mail to a typed-in address (D-111):
 * with Turnstile configured, a registration or a resend without a confirmed
 * token creates nothing and mails nobody.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, type Database } from "@/db/client";
import { pendingRegistrations } from "@/db/schema";
import { resetEnvCache } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { setBotCheckFetcher } from "@/lib/turnstile";
import { register, resendVerificationEmail } from "@/services/auth";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { noMeta, publishKvkkVersion } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

const registration = {
  email: "insan@example.com",
  password: "Uzun-Ve-Guclu-Parola-2026",
  displayName: "Gerçek İnsan",
  birthDate: "1995-05-05",
  kvkkConsent: true as const,
};

/** Cloudflare's answer for the next siteverify calls. */
function cloudflareSays(body: Record<string, unknown>) {
  setBotCheckFetcher(async () => new Response(JSON.stringify(body), { status: 200 }));
}

async function statusOf(promise: Promise<unknown>): Promise<number | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return error.status;
    throw error;
  }
}

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await publishKvkkVersion();
  mailbox.clear();
  Object.assign(process.env, { TURNSTILE_SITE_KEY: "site-key", TURNSTILE_SECRET_KEY: "secret-key" });
  resetEnvCache();
});

afterEach(() => {
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  resetEnvCache();
});

describe("registration behind Turnstile", () => {
  it("creates nothing and mails nobody without a token", async () => {
    cloudflareSays({ success: true, action: "register" });

    expect(await statusOf(register(registration, noMeta))).toBe(400);
    expect(await db.select().from(pendingRegistrations)).toHaveLength(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("creates nothing when Cloudflare rejects the token", async () => {
    cloudflareSays({ success: false, "error-codes": ["invalid-input-response"] });

    expect(await statusOf(register(registration, noMeta, "bot-token"))).toBe(400);
    expect(await db.select().from(pendingRegistrations)).toHaveLength(0);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("goes ahead as before when Cloudflare confirms the token", async () => {
    cloudflareSays({ success: true, action: "register" });

    const { email } = await register(registration, noMeta, "human-token");

    expect(email).toBe("insan@example.com");
    expect(await db.select().from(pendingRegistrations)).toHaveLength(1);
    expect(mailbox.lastTo("insan@example.com")).toBeDefined();
  });
});

describe("resending the verification link behind Turnstile", () => {
  it("mails nobody without a confirmed token", async () => {
    cloudflareSays({ success: true, action: "register" });
    await register(registration, noMeta, "human-token");
    mailbox.clear();

    cloudflareSays({ success: true, action: "resend_verification" });
    expect(await statusOf(resendVerificationEmail("insan@example.com", noMeta))).toBe(400);
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("refuses a registration token replayed on the resend form", async () => {
    cloudflareSays({ success: true, action: "register" });
    await register(registration, noMeta, "human-token");
    mailbox.clear();

    expect(await statusOf(resendVerificationEmail("insan@example.com", noMeta, "human-token"))).toBe(400);
    expect(mailbox.outbox).toHaveLength(0);
  });
});
