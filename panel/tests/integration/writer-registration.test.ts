/**
 * The public writer registration (/yazar-basvuru) and the auto-approval that
 * follows e-mail verification (D-049): the address proof stands in for the
 * editorial review, so a verified candidate becomes a writer without any
 * editor/admin step — always with its role_changes record.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { roleChanges } from "@/db/schema";
import { db, type Database } from "@/db/client";
import { register, registerWriterCandidate, verifyEmail } from "@/services/auth";
import { setAccessMode } from "@/services/access-mode";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

const validWriter = {
  email: "Yeni.Yazar@Example.com",
  password: "Cok-Guclu-Sifre-2026",
  displayName: "Yeni Yazar",
  birthDate: "1994-04-12",
  kvkkConsent: true as const,
};

/** The reader registration has no birth-date field, so it is a different shape. */
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

describe("writer registration (/yazar-basvuru)", () => {
  it("creates a writer-intent account and sends a verification e-mail", async () => {
    const { user } = await registerWriterCandidate(validWriter, noMeta);

    expect(user.email).toBe("yeni.yazar@example.com"); // normalised
    expect(user.role).toBe("user");
    expect(user.writerIntentAt).not.toBeNull();
    expect(user.birthDate).toBe("1994-04-12");
    expect(user.emailVerifiedAt).toBeNull();
    expect(mailbox.lastTo("yeni.yazar@example.com")?.subject).toContain("doğrulayın");
  });

  it("refuses an underage or future birth date", async () => {
    const minor = await captureError(
      registerWriterCandidate({ ...validWriter, birthDate: "2012-05-05" }, noMeta),
    );
    expect(minor.status).toBe(400);

    const future = await captureError(
      registerWriterCandidate({ ...validWriter, email: "f@example.com", birthDate: "2999-01-01" }, noMeta),
    );
    expect(future.status).toBe(400);
  });

  it("refuses a duplicate address", async () => {
    await registerWriterCandidate(validWriter, noMeta);
    const error = await captureError(registerWriterCandidate(validWriter, noMeta));
    expect(error.status).toBe(409);
  });

  it("is open even while the site is closed, unlike the reader registration", async () => {
    const admin = await createUser({ role: "admin" });
    await setAccessMode(actorOf(admin), { mode: "closed" }, noMeta);

    const readerError = await captureError(
      register({ ...validReader, email: "okur@example.com" }, noMeta),
    );
    expect(readerError.status).toBe(409);

    const { user } = await registerWriterCandidate(
      { ...validWriter, email: "yazar2@example.com" },
      noMeta,
    );
    expect(user.writerIntentAt).not.toBeNull();
  });
});

describe("writer auto-approval on e-mail verification", () => {
  it("promotes the verified candidate to writer and records the role change", async () => {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const { user, verificationToken } = await registerWriterCandidate(validWriter, noMeta);

    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.emailVerifiedAt).not.toBeNull();
    expect(verified.role).toBe("writer");
    expect(verified.writerStatus).toBe("pending_agreement");

    const changes = await db
      .select()
      .from(roleChanges)
      .where(eq(roleChanges.userId, user.id));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ oldRole: "user", newRole: "writer", changedBy: user.id });
    expect(mailbox.lastTo("yeni.yazar@example.com")?.subject).toContain("yetkilendirildiniz");
  });

  it("leaves a reader account a reader when it verifies", async () => {
    const { verificationToken } = await register(validReader, noMeta);
    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.role).toBe("user");
    expect(verified.writerIntentAt).toBeNull();
  });

  it("does not promote a candidate while no contract is published", async () => {
    const { verificationToken } = await registerWriterCandidate(validWriter, noMeta);
    // No contract setup on purpose: the readiness check fails, so the account
    // stays a reader instead of being promoted into an unsignable state
    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.role).toBe("user");

    const changes = await db.select().from(roleChanges);
    expect(changes).toHaveLength(0);
  });
});
