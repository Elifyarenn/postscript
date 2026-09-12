/**
 * The standard reader/user registration (D-063, D-064, D-067).
 *
 * The only public sign-up is the reader path: the account does not exist until
 * the verification link is followed, it always gets the plain `user` role, and
 * verification never promotes anyone — writer and editor roles come from the
 * admin panel only.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { pendingRegistrations, users } from "@/db/schema";
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
  birthDate: "1995-05-20",
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
  it("stores the request and sends a link, but creates no account yet (D-067)", async () => {
    const { email, verificationToken } = await register(validReader, noMeta);

    expect(email).toBe("yeni.okur@example.com"); // normalised
    expect(verificationToken).toBeTruthy();
    expect(mailbox.lastTo(email)?.subject).toContain("doğrula");

    // The users table is untouched; only the pending row exists
    const accounts = await db
      .select()
      .from(users)
      .where(eq(users.email, "yeni.okur@example.com"));
    expect(accounts).toHaveLength(0);

    const pending = await db
      .select()
      .from(pendingRegistrations)
      .where(eq(pendingRegistrations.email, "yeni.okur@example.com"));
    expect(pending).toHaveLength(1);
    expect(pending[0]!.passwordHash).not.toBe(validReader.password);
  });

  it("requires a birth date and refuses invalid or future ones", async () => {
    const missing = await captureError(
      register({ ...validReader, email: "tarihsiz@example.com", birthDate: undefined }, noMeta),
    );
    expect(missing.status).toBe(400);

    const impossible = await captureError(
      register({ ...validReader, email: "imkansiz@example.com", birthDate: "2025-02-30" }, noMeta),
    );
    expect(impossible.status).toBe(400);

    const future = await captureError(
      register({ ...validReader, email: "gelecek@example.com", birthDate: "2999-01-01" }, noMeta),
    );
    expect(future.status).toBe(400);
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

  it("refuses an address that belongs to a live account", async () => {
    const { verificationToken } = await register(validReader, noMeta);
    await verifyEmail(verificationToken, noMeta);

    const error = await captureError(register(validReader, noMeta));
    expect(error.status).toBe(409);
  });

  it("lets a newer submission for the same address supersede the old one", async () => {
    const first = await register(validReader, noMeta);
    const second = await register(validReader, noMeta);
    expect(second.verificationToken).not.toBe(first.verificationToken);

    // Only the newest link works; the first is dead
    const stale = await captureError(verifyEmail(first.verificationToken, noMeta));
    expect(stale.status).toBe(400);

    const verified = await verifyEmail(second.verificationToken, noMeta);
    expect(verified.emailVerifiedAt).not.toBeNull();
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
  it("creates the account at verification, born verified and as a plain reader", async () => {
    const { verificationToken } = await register(validReader, noMeta);

    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(verified.role).toBe("user");
    expect(verified.email).toBe("yeni.okur@example.com");
    expect(verified.birthDate).toBe("1995-05-20");
    expect(verified.writerStatus).toBeNull();
    expect(verified.kvkkConsentAt).not.toBeNull();

    // The pending row (password hash, birth date) is gone once the account exists
    const pending = await db
      .select()
      .from(pendingRegistrations)
      .where(eq(pendingRegistrations.email, "yeni.okur@example.com"));
    expect(pending).toHaveLength(0);
  });

  it("refuses a spent or unknown token", async () => {
    const { verificationToken } = await register(validReader, noMeta);
    await verifyEmail(verificationToken, noMeta);

    // The consumed pending row is hard-deleted, so a reused link is
    // indistinguishable from an unknown one: 404 (D-067)
    const spent = await captureError(verifyEmail(verificationToken, noMeta));
    expect(spent.status).toBe(404);

    const unknown = await captureError(verifyEmail("made-up-token-value", noMeta));
    expect(unknown.status).toBe(404);
  });
});