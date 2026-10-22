/**
 * The interim publish guard (D-347): the licensed text and the published text
 * must be the same, or differ only by recorded corrections.
 */
import { describe, expect, it } from "vitest";
import { hashDocument } from "@/lib/agreement/normalise";
import { checkLicenceCoverage, type CoverageGrant, type CoverageVersion } from "@/lib/licence-coverage";

const licensed = "İlk paragraf.\n\nİkinci paragraf.";
const corrected = "İlk paragraf.\n\nİkinci paragraf, düzeltildi.";
const signedAt = new Date("2026-10-01T10:00:00Z");

const declared: CoverageGrant = {
  formTextHash: hashDocument(licensed),
  acceptedBodyMarkdown: licensed,
  acceptedVersion: 2,
  signedAt,
};

function version(
  number: number,
  body: string,
  changeKind: CoverageVersion["changeKind"] = "correction",
  createdAt = new Date(signedAt.getTime() + number * 60_000),
): CoverageVersion {
  return { version: number, bodyMarkdown: body, changeKind, createdAt };
}

describe("checkLicenceCoverage", () => {
  it("covers the licensed text itself, whitespace normalised as in the hash", () => {
    expect(checkLicenceCoverage(declared, licensed, []).ok).toBe(true);
    expect(checkLicenceCoverage(declared, `${licensed.replace(/\n/g, "\r\n")}  \n`, []).ok).toBe(true);
  });

  it("covers a text reached only by recorded corrections", () => {
    const versions = [version(1, "taslak", "content_change"), version(2, licensed), version(3, corrected)];
    expect(checkLicenceCoverage(declared, corrected, versions).ok).toBe(true);
  });

  it("refuses a text that moved without a version on record", () => {
    const result = checkLicenceCoverage(declared, corrected, [version(2, licensed)]);
    expect(result.ok).toBe(false);
  });

  it("refuses when a content change sits after the licence", () => {
    const versions = [version(2, licensed), version(3, corrected, "content_change")];
    expect(checkLicenceCoverage(declared, corrected, versions).ok).toBe(false);
  });

  it("refuses when the newest correction is not the text being published", () => {
    const versions = [version(2, licensed), version(3, corrected)];
    expect(checkLicenceCoverage(declared, `${corrected} Sonradan eklenen.`, versions).ok).toBe(false);
  });

  it("ignores the content changes made before the licence", () => {
    const versions = [version(1, "taslak", "content_change"), version(2, licensed)];
    expect(checkLicenceCoverage(declared, licensed, versions).ok).toBe(true);
  });

  it("refuses a record whose stored text no longer matches its hash", () => {
    const tampered = { ...declared, acceptedBodyMarkdown: `${licensed} (değiştirildi)` };
    const result = checkLicenceCoverage(tampered, licensed, []);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/kayıt bozulmuş/);
  });

  it("dates an on-screen approval by its moment when it names no version", () => {
    const approved: CoverageGrant = { formTextHash: hashDocument(licensed), acceptedBodyMarkdown: null, acceptedVersion: null, signedAt };
    const before = version(5, corrected, "correction", new Date(signedAt.getTime() - 60_000));
    const after = version(6, corrected, "correction", new Date(signedAt.getTime() + 60_000));
    expect(checkLicenceCoverage(approved, corrected, [before]).ok).toBe(false);
    expect(checkLicenceCoverage(approved, corrected, [before, after]).ok).toBe(true);
  });

  it("allows only the exact text when the approval has neither version nor moment", () => {
    const bare: CoverageGrant = { formTextHash: hashDocument(licensed), acceptedBodyMarkdown: null, acceptedVersion: null, signedAt: null };
    expect(checkLicenceCoverage(bare, licensed, []).ok).toBe(true);
    expect(checkLicenceCoverage(bare, corrected, [version(9, corrected)]).ok).toBe(false);
  });
});
