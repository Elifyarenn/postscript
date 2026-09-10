/**
 * The standard reader/user registration (D-063, D-064).
 *
 * The only public sign-up is the reader path: every new account gets the plain
 * `user` role, the address has to be verified by e-mail, and verification never
 * promotes anyone — writer and editor roles come from the admin panel only.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { db, type Database } from "@/db/client";
import { register, verifyEmail } from "@/services/auth";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { noMeta } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

const validReader = {
  email: "Yeni.Okur@Example.com",
  password: "Cok-Guclu-Sifre-2026",
  displayName: "Yeni Okur",
  kvkkConsent: true as const,
};

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

describe("reader registration", () => {
  it("creates a plain `user` account and sends a verification link", async () => {
    const { user, verificationToken } = await register(validReader, noMeta);

    expect(user.role).toBe("user");
    expect(user.writerIntentAt).toBeNull();
    expect(user.writerStatus).toBeNull();
    expect(user.email).toBe("yeni.okur@example.com");
    expect(verificationToken).toBeTruthy();
    expect(mailbox.lastTo(user.email)?.subject).toContain("doğrula");
  });

  it("never accepts a role from the request", async () => {
    // The schema is strict: a `role` field is simply not part of the reader
    // registration contract, so a hand-crafted payload with one is refused.
    const error = await captureError(
      register({ ...validReader, role: "admin" } as never, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("requires the KVKK consent", async () => {
    const error = await captureError(
      register({ ...validReader, email: "kvkk@example.com", kvkkConsent: false }, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("refuses a duplicate address", async () => {
    await register(validReader, noMeta);
    const error = await captureError(register(validReader, noMeta));
    expect(error.status).toBe(409);
  });

  it("refuses a password from the common-password list", async () => {
    const error = await captureError(
      register(
        { ...validReader, email: "zayif@example.com", password: "Password1" },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.message).toMatch(/yaygın kullanılıyor/i);
  });
});

describe("verification", () => {
  it("verifies the address and leaves the role untouched (no auto-promotion)", async () => {
    const { user, verificationToken } = await register(validReader, noMeta);

    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(verified.role).toBe("user");

    const rows = await db.select().from(users).where(eq(users.id, user.id));
    expect(rows[0]!.role).toBe("user");
    expect(rows[0]!.writerStatus).toBeNull();
  });

  it("refuses a spent or unknown token", async () => {
    const { verificationToken } = await register(validReader, noMeta);
    await verifyEmail(verificationToken, noMeta);

    const error = await captureError(verifyEmail(verificationToken, noMeta));
    expect(error.status).toBe(400);
  });
});