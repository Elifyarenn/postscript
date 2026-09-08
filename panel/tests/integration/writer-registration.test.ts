/**
 * The public writer registration (/yazar-basvuru) and the auto-approval that
 * follows e-mail verification (D-049): the address proof stands in for the
 * editorial review, so a verified candidate becomes a writer without any
 * editor/admin step — always with its role_changes record.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { roleChanges, users } from "@/db/schema";
import { db, type Database } from "@/db/client";
import { register, registerWriterCandidate, verifyEmail } from "@/services/auth";
import { setAccessMode } from "@/services/access-mode";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

const validWriter = {
  email: "Yeni.Yazar@Example.com",
  password: "Cok-Guclu-Sifre-2026",
  displayName: "Yeni Yazar",
  birthDate: "1994-04-12",
  area: "Sanat & Edebiyat",
  phone: "0532 123 45 67",
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
  await seedDefaultWriterAreas();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
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

/** Creates `n` approved writers holding an area, as the quota counts them. */
async function seedWriters(area: string, n: number): Promise<void> {
  for (let index = 0; index < n; index += 1) {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: area }).where(eq(users.id, writer.id));
  }
}

describe("writer registration (/yazar-basvuru)", () => {
  it("creates a writer-intent account and sends a verification e-mail", async () => {
    const { user } = await registerWriterCandidate(validWriter, noMeta);

    expect(user.email).toBe("yeni.yazar@example.com"); // normalised
    expect(user.role).toBe("user");
    expect(user.writerIntentAt).not.toBeNull();
    expect(user.birthDate).toBe("1994-04-12");
    expect(user.emailVerifiedAt).toBeNull();
    // No KVKK consent is collected at registration for now (D-050)
    expect(user.kvkkConsentAt).toBeNull();
    expect(user.writerArea).toBe("Sanat & Edebiyat");
    expect(user.phone).toBe("05321234567"); // normalised
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

  it("refuses an area outside the fixed list", async () => {
    const error = await captureError(
      registerWriterCandidate({ ...validWriter, area: "Boyle bir alan yok" }, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("refuses an invalid phone number", async () => {
    const error = await captureError(
      registerWriterCandidate({ ...validWriter, phone: "harfler" }, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("accepts writers up to the area quota and refuses the fourth (D-052)", async () => {
    // Two approved writers already hold the area; the registration fills the
    // third slot…
    await seedWriters("Sanat & Edebiyat", 2);
    const { user } = await registerWriterCandidate(
      { ...validWriter, email: "dolmayan@example.com" },
      noMeta,
    );
    expect(user.writerArea).toBe("Sanat & Edebiyat");

    // …and once three hold it, the fourth is refused by name
    await seedWriters("Sanat & Edebiyat", 1);
    const error = await captureError(
      registerWriterCandidate(
        { ...validWriter, email: "tasiyor@example.com" },
        noMeta,
      ),
    );
    expect(error.status).toBe(400);
    expect(error.details?.area?.[0]).toContain("kontenjanı dolu");
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
    expect(verified.writerStatus).toBe("active");

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

  it("promotes even before a contract is published", async () => {
    const { verificationToken } = await registerWriterCandidate(validWriter, noMeta);
    // No contract setup on purpose: a contract is no longer a prerequisite
    // (D-050), so the verified candidate still becomes an active writer
    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.role).toBe("writer");
    expect(verified.writerStatus).toBe("active");

    const changes = await db.select().from(roleChanges);
    expect(changes).toHaveLength(1);
  });
});
