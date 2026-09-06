/**
 * Hash generation and secret encryption (§13.3).
 */
import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  hashToken,
  randomToken,
  safeEquals,
  sha256Hex,
} from "@/lib/crypto";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/password";
import { meetsPasswordRules, passwordRules } from "@/lib/password-rules";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("sha256Hex", () => {
  it("produces the known digest of the empty string", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("is stable and case sensitive", () => {
    expect(sha256Hex("postscript")).toBe(sha256Hex("postscript"));
    expect(sha256Hex("postscript")).not.toBe(sha256Hex("Postscript"));
  });

  it("hashes Turkish characters consistently", () => {
    // The agreement hash covers the exact published text, accents included
    expect(sha256Hex("çğıöşü")).toHaveLength(64);
    expect(sha256Hex("çğıöşü")).toBe(sha256Hex("çğıöşü"));
  });
});

describe("token hashing", () => {
  it("gives different digests for different peppers", () => {
    expect(hashToken("abc", "pepper-one")).not.toBe(hashToken("abc", "pepper-two"));
  });

  it("never returns the raw token", () => {
    const token = randomToken(32);
    expect(hashToken(token, "pepper")).not.toContain(token);
  });

  it("produces url-safe tokens of the requested strength", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(randomToken(32)).not.toBe(token);
  });
});

describe("safeEquals", () => {
  it("compares equal strings as equal", () => {
    expect(safeEquals("token-value", "token-value")).toBe(true);
  });

  it("returns false for different values and different lengths", () => {
    expect(safeEquals("token-value", "token-valuex")).toBe(false);
    expect(safeEquals("a", "b")).toBe(false);
  });
});

describe("secret encryption", () => {
  const secret = "session-secret-for-tests-0123456789";

  it("round-trips a TOTP secret", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", secret);
    expect(decryptSecret(payload, secret)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("produces a different ciphertext every time", () => {
    expect(encryptSecret("same", secret)).not.toBe(encryptSecret("same", secret));
  });

  it("refuses a payload encrypted with another key", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", secret);
    expect(() => decryptSecret(payload, "a-completely-different-secret")).toThrow();
  });

  it("refuses a tampered payload", () => {
    const payload = encryptSecret("JBSWY3DPEHPK3PXP", secret);
    const parts = payload.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), secret)).toThrow();
  });
});

describe("password rules", () => {
  it("accepts a password that satisfies all three rules", () => {
    expect(meetsPasswordRules("Gecerli12")).toBe(true);
    expect(checkPasswordPolicy("Gecerli12").ok).toBe(true);
  });

  it("names each rule and reports whether it is met", () => {
    // Long enough and mixed case, but no digit: exactly one rule outstanding
    const rules = passwordRules("KarisikHarf");
    expect(rules.map((rule) => rule.id)).toEqual(["length", "letterCase", "digit"]);
    expect(rules.find((rule) => rule.id === "length")?.met).toBe(true);
    expect(rules.find((rule) => rule.id === "letterCase")?.met).toBe(true);
    expect(rules.find((rule) => rule.id === "digit")?.met).toBe(false);
  });

  it("reports every rule as unmet for an empty password", () => {
    expect(passwordRules("").every((rule) => rule.met)).toBe(false);
    expect(passwordRules("").some((rule) => rule.met)).toBe(false);
  });

  it("requires eight characters", () => {
    expect(meetsPasswordRules("Short1")).toBe(false);
    expect(meetsPasswordRules("Sekizli1")).toBe(true);
  });

  it("requires both cases", () => {
    expect(meetsPasswordRules("hepsikucuk1")).toBe(false);
    expect(meetsPasswordRules("HEPSIBUYUK1")).toBe(false);
    expect(meetsPasswordRules("KarisikHarf1")).toBe(true);
  });

  it("requires a digit", () => {
    expect(meetsPasswordRules("HicRakamYok")).toBe(false);
    expect(meetsPasswordRules("BirRakam1")).toBe(true);
  });

  it("counts Turkish letters as upper and lower case", () => {
    expect(meetsPasswordRules("Şifreçğı1")).toBe(true);
  });
});

describe("password policy", () => {
  it("rejects an entry from the common list even when it satisfies the rules", () => {
    // "Password1" lowercases to an entry in the embedded 10.000 list
    expect(meetsPasswordRules("Password1")).toBe(true);
    const result = checkPasswordPolicy("Password1");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/yaygın/i);
  });

  it("reports the first unmet rule", () => {
    const result = checkPasswordPolicy("kisa");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/en az 8 karakter/i);
  });

  it("refuses an absurdly long password", () => {
    expect(checkPasswordPolicy("Aa1" + "x".repeat(300)).ok).toBe(false);
  });
});

describe("argon2id hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const digest = await hashPassword("correct horse battery");
    expect(digest.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(digest, "correct horse battery")).toBe(true);
    expect(await verifyPassword(digest, "wrong horse battery")).toBe(false);
  });

  it("salts, so the same password hashes differently", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("treats a corrupt stored hash as a failed login rather than throwing", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("slugify", () => {
  it("transliterates Turkish characters", () => {
    expect(slugify("Şiir ve Öykü Günlüğü")).toBe("siir-ve-oyku-gunlugu");
    expect(slugify("Işık ve Gölge")).toBe("isik-ve-golge");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("  Merhaba,   Dünya!  ")).toBe("merhaba-dunya");
  });

  it("appends a suffix until the slug is free", async () => {
    const taken = new Set(["deneme", "deneme-2"]);
    expect(await uniqueSlug("Deneme", async (c) => taken.has(c))).toBe("deneme-3");
  });

  it("falls back to a default when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
  });
});
