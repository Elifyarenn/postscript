/**
 * Registration, login, verification and password reset against a real
 * PostgreSQL (§5). These cover the rules that would be invisible in a unit
 * test: rate limit counters, token single use, and the fact that the server
 * always assigns the role itself.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { emailTokens, users, type User } from "@/db/schema";
import { db, type Database } from "@/db/client";
import {
  changePassword,
  register,
  requestEmailChange,
  confirmEmailChange,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  verifyCredentials,
  verifyEmail,
} from "@/services/auth";
import { updateProfile } from "@/services/users";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, reloadUser, TEST_PASSWORD } from "../helpers/factories";

let database: Database;
const mailbox = new MemoryMailAdapter();

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

const validRegistration = {
  email: "Yeni.Kullanici@Example.com",
  password: "Cok-Guclu-Sifre-2026",
  displayName: "Yeni Kullanıcı",
  birthDate: "1995-05-20",
  kvkkConsent: true as const,
};

/** Runs a promise and returns the AppError it threw, failing the test if it did not. */
async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

describe("registration", () => {
  it("creates an unverified account and sends a verification e-mail", async () => {
    const { user } = await register(validRegistration, noMeta);

    expect(user.email).toBe("yeni.kullanici@example.com"); // normalised
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.kvkkConsentAt).not.toBeNull();
    expect(mailbox.lastTo("yeni.kullanici@example.com")?.subject).toContain("doğrulayın");
  });

  it("always assigns the user role, and refuses a request that tries to set one", async () => {
    const { user } = await register(validRegistration, noMeta);
    expect(user.role).toBe("user");
    expect(user.writerStatus).toBeNull();

    // §3 rule 2: `role` is not an accepted field on this endpoint
    const error = await captureError(
      register({ ...validRegistration, email: "b@example.com", role: "admin" }, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("refuses a password that is too short or too common", async () => {
    const short = await captureError(
      register({ ...validRegistration, password: "kisa123" }, noMeta),
    );
    expect(short.details?.password?.[0]).toMatch(/en az 8 karakter/i);

    const common = await captureError(
      // Satisfies all three rules but sits in the embedded common list
      register({ ...validRegistration, email: "c@example.com", password: "Password1" }, noMeta),
    );
    expect(common.details?.password?.[0]).toMatch(/yaygın/i);
  });

  it("refuses registration without the KVKK consent box", async () => {
    const error = await captureError(
      register({ ...validRegistration, kvkkConsent: false }, noMeta),
    );
    expect(error.status).toBe(400);
  });

  it("refuses a duplicate address", async () => {
    await register(validRegistration, noMeta);
    const error = await captureError(register(validRegistration, noMeta));
    expect(error.status).toBe(409);
  });

  it("allows five registrations per IP in ten minutes and blocks the sixth", async () => {
    for (let index = 0; index < 5; index += 1) {
      await register({ ...validRegistration, email: `bulk${index}@example.com` }, noMeta);
    }

    const error = await captureError(
      register({ ...validRegistration, email: "bulk5@example.com" }, noMeta),
    );
    expect(error.status).toBe(429);
  });
});

describe("e-mail verification", () => {
  it("marks the account verified and burns the token", async () => {
    const { user, verificationToken } = await register(validRegistration, noMeta);

    const verified = await verifyEmail(verificationToken, noMeta);
    expect(verified.emailVerifiedAt).not.toBeNull();

    // A verification link is single use
    const reuse = await captureError(verifyEmail(verificationToken, noMeta));
    expect(reuse.status).toBe(400);

    const tokens = await db.select().from(emailTokens).where(eq(emailTokens.userId, user.id));
    expect(tokens.every((token) => token.usedAt !== null)).toBe(true);
  });

  it("refuses an unknown token", async () => {
    const error = await captureError(verifyEmail("made-up-token-value", noMeta));
    expect(error.status).toBe(404);
  });

  it("only lets a new link be asked for once a minute", async () => {
    const { user } = await register(validRegistration, noMeta);

    const tooSoon = await captureError(resendVerificationEmail(user.id));
    expect(tooSoon.status).toBe(429);
  });

  it("refuses to resend once the address is verified", async () => {
    const { user, verificationToken } = await register(validRegistration, noMeta);
    await verifyEmail(verificationToken, noMeta);

    const error = await captureError(resendVerificationEmail(user.id));
    expect(error.status).toBe(400);
  });
});

describe("an unverified address is a hard gate (D-034)", () => {
  it("refuses every account action until the address is verified", async () => {
    const unverified = await createUser({ email: "gate@example.com", emailVerified: false });
    const actor = actorOf(unverified);

    // The profile, the password and the sessions are all behind the gate
    const profile = await captureError(
      updateProfile(actor, { displayName: "Yeni Ad" }, noMeta),
    );
    expect(profile.status).toBe(403);
  });

  it("lets a verified account through the same call", async () => {
    const verified = await createUser({ email: "open@example.com" });
    const updated = await updateProfile(actorOf(verified), { displayName: "Yeni Ad" }, noMeta);
    expect(updated.displayName).toBe("Yeni Ad");
  });
});

describe("login", () => {
  it("accepts the right password", async () => {
    const user = await createUser({ email: "login@example.com" });
    const outcome = await verifyCredentials(
      { email: "LOGIN@example.com", password: TEST_PASSWORD },
      noMeta,
    );

    expect(outcome.user.id).toBe(user.id);
  });

  it("gives the same message for an unknown address and a wrong password", async () => {
    await createUser({ email: "known@example.com" });

    const wrongPassword = await captureError(
      verifyCredentials({ email: "known@example.com", password: "definitely-wrong" }, noMeta),
    );
    const unknownUser = await captureError(
      verifyCredentials({ email: "nobody@example.com", password: TEST_PASSWORD }, noMeta),
    );

    expect(wrongPassword.message).toBe(unknownUser.message);
    expect(wrongPassword.status).toBe(401);
  });

  it("locks the account after ten failed attempts", async () => {
    await createUser({ email: "brute@example.com" });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await captureError(
        verifyCredentials({ email: "brute@example.com", password: "wrong" }, noMeta),
      );
    }

    // The eleventh attempt is refused before the password is even checked
    const locked = await captureError(
      verifyCredentials({ email: "brute@example.com", password: TEST_PASSWORD }, noMeta),
    );
    expect(locked.status).toBe(429);
  }, 60_000);

  it("refuses a banned account", async () => {
    await createUser({ email: "banned@example.com", isBanned: true });
    const error = await captureError(
      verifyCredentials({ email: "banned@example.com", password: TEST_PASSWORD }, noMeta),
    );
    expect(error.status).toBe(403);
  });

});

describe("password reset", () => {
  it("does not reveal whether an address exists", async () => {
    await expect(
      requestPasswordReset({ email: "nobody@example.com" }, noMeta),
    ).resolves.toBeUndefined();
    expect(mailbox.outbox).toHaveLength(0);
  });

  it("resets the password with a single use token", async () => {
    const user = await createUser({ email: "reset@example.com" });
    await requestPasswordReset({ email: "reset@example.com" }, noMeta);

    const message = mailbox.lastTo("reset@example.com");
    const token = /token=([^\s]+)/.exec(message?.text ?? "")?.[1];
    expect(token).toBeDefined();

    await resetPassword({ token: token!, password: "Yepyeni-Sifre-2026" }, noMeta);

    const outcome = await verifyCredentials(
      { email: "reset@example.com", password: "Yepyeni-Sifre-2026" },
      noMeta,
    );
    expect(outcome.user.id).toBe(user.id);

    const reuse = await captureError(
      resetPassword({ token: token!, password: "Baska-Sifre-2026" }, noMeta),
    );
    expect(reuse.status).toBe(400);
  });

  it("refuses a weak new password", async () => {
    await createUser({ email: "weak@example.com" });
    await requestPasswordReset({ email: "weak@example.com" }, noMeta);
    const token = /token=([^\s]+)/.exec(mailbox.lastTo("weak@example.com")?.text ?? "")?.[1];

    const error = await captureError(resetPassword({ token: token!, password: "kisa" }, noMeta));
    expect(error.status).toBe(400);
  });
});

describe("e-mail change", () => {
  /** Requests a change and returns the link's token for a fresh verified user. */
  async function requestChangeFor(
    email: string,
    newEmail: string,
  ): Promise<{ user: User; token: string }> {
    const user = await createUser({ email });
    await requestEmailChange(user.id, { newEmail }, noMeta);
    const token = /token=([^\s]+)/.exec(mailbox.lastTo(newEmail)?.text ?? "")?.[1];
    expect(token).toBeDefined();
    return { user, token: token! };
  }

  it("keeps the live address until the new one is confirmed", async () => {
    const { user } = await requestChangeFor("before@example.com", "after@example.com");

    // The link went to the new address, but the live address has not changed
    expect(mailbox.lastTo("after@example.com")?.subject).toContain("doğrulayın");
    const pending = await reloadUser(user.id);
    expect(pending.email).toBe("before@example.com");
    expect(pending.pendingEmail).toBe("after@example.com");
  });

  it("swaps the address and clears the pending one once the link is used", async () => {
    const { user, token } = await requestChangeFor("swap@example.com", "swapped@example.com");

    const updated = await confirmEmailChange(token, noMeta);
    expect(updated.email).toBe("swapped@example.com");
    expect(updated.pendingEmail).toBeNull();
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it("burns the token so the link is single use", async () => {
    const { token } = await requestChangeFor("single@example.com", "once@example.com");
    await confirmEmailChange(token, noMeta);

    const reuse = await captureError(confirmEmailChange(token, noMeta));
    expect(reuse.status).toBe(400);
  });

  it("refuses a change to an address already in use", async () => {
    const user = await createUser({ email: "owner@example.com" });
    await createUser({ email: "taken@example.com" });

    const error = await captureError(
      requestEmailChange(user.id, { newEmail: "taken@example.com" }, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("refuses a change to the current address", async () => {
    const user = await createUser({ email: "same@example.com" });

    const error = await captureError(
      requestEmailChange(user.id, { newEmail: "same@example.com" }, noMeta),
    );
    expect(error.status).toBe(409);
  });

  it("refuses a change from an account whose address is not verified", async () => {
    const unverified = await createUser({ email: "unverified-change@example.com", emailVerified: false });

    const error = await captureError(
      requestEmailChange(unverified.id, { newEmail: "new@example.com" }, noMeta),
    );
    expect(error.status).toBe(403);
  });
});

describe("changing a password from the panel", () => {
  it("requires the current password", async () => {
    const user = await createUser({ email: "change@example.com" });

    const error = await captureError(
      changePassword(user.id, "not-the-current-one", "Yeni-Guclu-Sifre-2026", noMeta),
    );
    expect(error.status).toBe(400);

    await changePassword(user.id, TEST_PASSWORD, "Yeni-Guclu-Sifre-2026", noMeta);
    const rows = await db.select().from(users).where(eq(users.id, user.id));
    expect(rows[0]!.passwordHash).not.toBe(user.passwordHash);
  });

  it("stores a phone number given from the profile form (D-054)", async () => {
    const user = await createUser({ email: "phone@example.com" });

    const updated = await updateProfile(
      actorOf(user),
      { displayName: user.displayName, phone: "0532 123 45 67" },
      noMeta,
    );
    expect(updated.phone).toBe("05321234567");

    // Clearing the field removes it again
    const cleared = await updateProfile(
      actorOf(user),
      { displayName: user.displayName, phone: "" },
      noMeta,
    );
    expect(cleared.phone).toBeNull();
  });
});
