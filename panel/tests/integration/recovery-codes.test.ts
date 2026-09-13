/**
 * Two-factor recovery codes (D-099): generated as a set of ten, stored only as
 * hashes, spent one at a time, and accepted wherever the second factor is
 * asked for — login, turning 2FA off, generating a new set.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { generateSync } from "otplib";
import { db, type Database } from "@/db/client";
import { auditLog, totpRecoveryCodes, type User } from "@/db/schema";
import {
  countRecoveryCodesLeft,
  disableTotp,
  enableTotp,
  generateTotpSecret,
  RECOVERY_CODE_COUNT,
  regenerateRecoveryCodes,
  verifyLoginCode,
} from "@/services/two-factor";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { createUser, noMeta, reloadUser, TEST_PASSWORD } from "../helpers/factories";

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

/** An account with 2FA on and a fresh set of codes. */
async function withCodes(email = "yonetici@example.com"): Promise<{ user: User; secret: string; codes: string[] }> {
  const user = await createUser({ role: "admin", email });
  const secret = generateTotpSecret();
  await enableTotp(
    { userId: user.id, password: TEST_PASSWORD, pendingSecret: secret, code: nowCode(secret) },
    noMeta,
  );
  const codes = await regenerateRecoveryCodes(
    { userId: user.id, password: TEST_PASSWORD, code: nowCode(secret) },
    noMeta,
  );
  return { user, secret, codes };
}

describe("generating", () => {
  it("returns ten distinct readable codes and stores only their hashes", async () => {
    const { user, codes } = await withCodes();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/);

    const rows = await db.select().from(totpRecoveryCodes).where(eq(totpRecoveryCodes.userId, user.id));
    expect(rows).toHaveLength(RECOVERY_CODE_COUNT);
    for (const row of rows) {
      expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(codes.map((code) => code.replace("-", ""))).not.toContain(row.codeHash);
    }
    expect(await countRecoveryCodesLeft(user.id)).toBe(RECOVERY_CODE_COUNT);
  });

  it("makes the previous set useless", async () => {
    const { user, secret, codes: first } = await withCodes();
    await regenerateRecoveryCodes(
      { userId: user.id, password: TEST_PASSWORD, code: nowCode(secret) },
      noMeta,
    );

    expect(await verifyLoginCode(user.id, first[0]!)).toBe(false);
    expect(await countRecoveryCodesLeft(user.id)).toBe(RECOVERY_CODE_COUNT);
  });

  it("needs the password and a second factor, and 2FA switched on", async () => {
    const { user } = await withCodes();

    const wrongPassword = await captureError(
      regenerateRecoveryCodes({ userId: user.id, password: "yanlis-sifre", code: "000000" }, noMeta),
    );
    expect(wrongPassword.code).toBe("forbidden");

    const wrongCode = await captureError(
      regenerateRecoveryCodes({ userId: user.id, password: TEST_PASSWORD, code: "000000" }, noMeta),
    );
    expect(wrongCode.code).toBe("bad_request");

    const plain = await createUser();
    const noFactor = await captureError(
      regenerateRecoveryCodes({ userId: plain.id, password: TEST_PASSWORD, code: "000000" }, noMeta),
    );
    expect(noFactor.code).toBe("bad_request");
  });
});

describe("logging in with a recovery code", () => {
  it("lets each code through once, however it is typed, and tells the owner", async () => {
    const { user, codes } = await withCodes();
    const typed = codes[0]!.toUpperCase().replace("-", " ");

    expect(await verifyLoginCode(user.id, typed, noMeta)).toBe(true);
    expect(await verifyLoginCode(user.id, codes[0]!, noMeta)).toBe(false);
    expect(await countRecoveryCodesLeft(user.id)).toBe(RECOVERY_CODE_COUNT - 1);

    const mail = mailbox.lastTo("yonetici@example.com");
    expect(mail?.subject).toContain("Kurtarma kodu");
    expect(mail?.text).toContain(`${RECOVERY_CODE_COUNT - 1}`);

    const audit = await db.select().from(auditLog).where(eq(auditLog.action, "user.recovery_code_used"));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0]!.after)).not.toContain(codes[0]!);
  });

  it("does not spend a recovery code on a mistyped six digit code", async () => {
    const { user } = await withCodes();

    expect(await verifyLoginCode(user.id, "000000", noMeta)).toBe(false);
    expect(await countRecoveryCodesLeft(user.id)).toBe(RECOVERY_CODE_COUNT);
  });

  it("does not accept another account's code", async () => {
    const { codes } = await withCodes("birinci@example.com");
    const { user: other } = await withCodes("ikinci@example.com");

    expect(await verifyLoginCode(other.id, codes[0]!, noMeta)).toBe(false);
  });
});

describe("replacing a lost phone", () => {
  it("turns 2FA off with the password and a recovery code, and drops the codes", async () => {
    const { user, codes } = await withCodes();

    await disableTotp({ userId: user.id, password: TEST_PASSWORD, code: codes[3]! }, noMeta);

    const reloaded = await reloadUser(user.id);
    expect(reloaded.totpEnabledAt).toBeNull();
    expect(reloaded.totpSecret).toBeNull();
    expect(await countRecoveryCodesLeft(user.id)).toBe(0);
  });
});
