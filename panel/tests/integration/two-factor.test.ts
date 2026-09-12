/**
 * The TOTP second factor (D-046): enable, disable, the login challenge
 * ticket, and the code brute force guard.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { generateSync, generateSecret } from "otplib";
import { loginChallenges, users } from "@/db/schema";
import { db, type Database } from "@/db/client";
import {
  checkLoginCodeLimit,
  consumeLoginChallenge,
  readLoginChallenge,
  createLoginChallenge,
  disableTotp,
  enableTotp,
  generateTotpSecret,
  otpauthUri,
  verifyLoginCode,
  verifyTotpCode,
} from "@/services/two-factor";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser, noMeta, TEST_PASSWORD } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

/** A code for `secret` that is valid right now. */
function nowCode(secret: string): string {
  return generateSync({ secret, strategy: "totp" });
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("expected the promise to reject");
}

describe("verifyTotpCode", () => {
  it("accepts the current code and nothing else", () => {
    const secret = generateSecret();
    const code = nowCode(secret);

    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(verifyTotpCode(secret, "000000")).toBe(false);
    expect(verifyTotpCode(secret, "12345")).toBe(false);
    expect(verifyTotpCode(secret, "abcdef")).toBe(false);
    expect(verifyTotpCode(secret, "")).toBe(false);
  });

  it("builds a scannable otpauth uri", () => {
    const uri = otpauthUri("JBSWY3DPEHPK3PXP", "editor@postscript.local");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("issuer=Postscript");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});

describe("enableTotp", () => {
  it("stores the secret and revokes every session only after a valid code", async () => {
    const user = await createUser();
    const pending = generateTotpSecret();

    // A wrong code changes nothing
    const error = await captureError(
      enableTotp(
        { userId: user.id, password: TEST_PASSWORD, pendingSecret: pending, code: "000000" },
        noMeta,
      ),
    );
    expect(error.code).toBe("bad_request");
    expect((await reloadUser(user.id)).totpEnabledAt).toBeNull();

    await enableTotp(
      { userId: user.id, password: TEST_PASSWORD, pendingSecret: pending, code: nowCode(pending) },
      noMeta,
    );

    const enabled = await reloadUser(user.id);
    expect(enabled.totpEnabledAt).not.toBeNull();
    expect(enabled.totpSecret).toContain("v1.");
    expect(await verifyLoginCode(user.id, nowCode(pending))).toBe(true);
  });

  it("refuses when the password is wrong", async () => {
    const user = await createUser();
    const pending = generateTotpSecret();

    const error = await captureError(
      enableTotp(
        { userId: user.id, password: "wrong-password", pendingSecret: pending, code: nowCode(pending) },
        noMeta,
      ),
    );
    expect(error.code).toBe("forbidden");
  });

  it("refuses to run twice", async () => {
    const user = await createUser();
    const pending = generateTotpSecret();
    await enableTotp(
      { userId: user.id, password: TEST_PASSWORD, pendingSecret: pending, code: nowCode(pending) },
      noMeta,
    );

    const error = await captureError(
      enableTotp(
        { userId: user.id, password: TEST_PASSWORD, pendingSecret: pending, code: nowCode(pending) },
        noMeta,
      ),
    );
    expect(error.code).toBe("conflict");
  });
});

describe("disableTotp", () => {
  it("turns the second factor off only with the password and a valid code", async () => {
    const user = await createUser();
    const pending = generateTotpSecret();
    await enableTotp(
      { userId: user.id, password: TEST_PASSWORD, pendingSecret: pending, code: nowCode(pending) },
      noMeta,
    );

    const wrongCode = await captureError(
      disableTotp({ userId: user.id, password: TEST_PASSWORD, code: "000000" }, noMeta),
    );
    expect(wrongCode.code).toBe("bad_request");

    await disableTotp(
      { userId: user.id, password: TEST_PASSWORD, code: nowCode(pending) },
      noMeta,
    );

    const disabled = await reloadUser(user.id);
    expect(disabled.totpEnabledAt).toBeNull();
    expect(disabled.totpSecret).toBeNull();
    expect(await verifyLoginCode(user.id, nowCode(pending))).toBe(false);
  });
});

describe("the login challenge ticket", () => {
  it("is single use and bound to the user it was issued for", async () => {
    const user = await createUser();

    const rawToken = await createLoginChallenge(user.id);
    expect(await readLoginChallenge(rawToken)).toBe(user.id);
    expect(await consumeLoginChallenge(rawToken)).toBe(true);

    // The same ticket cannot be spent twice
    expect(await consumeLoginChallenge(rawToken)).toBe(false);
    expect(await readLoginChallenge(rawToken)).toBeNull();

    // A forged ticket never resolves
    expect(await readLoginChallenge("not-a-real-token")).toBeNull();
    expect(await consumeLoginChallenge("not-a-real-token")).toBe(false);
  });

  /**
   * D-073: reading and spending are separate, so a mistyped code leaves the
   * ticket alive and the user stays on the code screen.
   */
  it("survives a reading that is not followed by a spend", async () => {
    const user = await createUser();
    const rawToken = await createLoginChallenge(user.id);

    // Three failed attempts in a row: the ticket is untouched each time
    expect(await readLoginChallenge(rawToken)).toBe(user.id);
    expect(await readLoginChallenge(rawToken)).toBe(user.id);
    expect(await readLoginChallenge(rawToken)).toBe(user.id);

    // The eventual success still works
    expect(await consumeLoginChallenge(rawToken)).toBe(true);
  });

  it("rejects an expired ticket", async () => {
    const user = await createUser();
    const rawToken = await createLoginChallenge(user.id);
    await db
      .update(loginChallenges)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(loginChallenges.userId, user.id));

    expect(await readLoginChallenge(rawToken)).toBeNull();
    expect(await consumeLoginChallenge(rawToken)).toBe(false);
  });
});

describe("the code brute force guard", () => {
  it("locks a user out after five guesses per window", async () => {
    const user = await createUser();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(checkLoginCodeLimit(user.id)).resolves.toBeUndefined();
    }
    const locked = await captureError(checkLoginCodeLimit(user.id));
    expect(locked.code).toBe("rate_limited");
  });
});

async function reloadUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]!;
}