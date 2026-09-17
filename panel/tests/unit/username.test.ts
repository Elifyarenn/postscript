import { describe, expect, it } from "vitest";
import {
  nextUsernameChangeAt,
  normalizeUsername,
  usernameProblem,
  rankUsernameMatches,
  usernameSearchPattern,
  usernameSearchTerm,
} from "@/lib/username";

describe("the handle change window (D-166)", () => {
  const now = new Date("2026-09-16T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("is open when the handle was never replaced", () => {
    expect(nextUsernameChangeAt(null, now)).toBeNull();
  });

  it("stays closed for 30 days after a change and names the day it opens", () => {
    expect(nextUsernameChangeAt(daysAgo(1), now)?.toISOString()).toBe("2026-10-15T12:00:00.000Z");
    expect(nextUsernameChangeAt(daysAgo(29), now)).not.toBeNull();
  });

  it("opens again once 30 days have passed", () => {
    expect(nextUsernameChangeAt(daysAgo(30), now)).toBeNull();
    expect(nextUsernameChangeAt(daysAgo(45), now)).toBeNull();
  });
});

describe("community handles (D-089)", () => {
  it("normalises case, whitespace and a leading @", () => {
    expect(normalizeUsername("  @Lunae_01 ")).toBe("lunae_01");
  });

  it("accepts letters, digits and underscores within the length limits", () => {
    expect(usernameProblem("lunae")).toBeNull();
    expect(usernameProblem("a_1")).toBeNull();
    expect(usernameProblem("x".repeat(20))).toBeNull();
  });

  it("refuses handles that are too short or too long", () => {
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("x".repeat(21))).not.toBeNull();
  });

  it("refuses Turkish letters, dots and spaces", () => {
    expect(usernameProblem("çiçek")).not.toBeNull();
    expect(usernameProblem("ada.yazar")).not.toBeNull();
    expect(usernameProblem("ada yazar")).not.toBeNull();
  });

  it("refuses handles that pass as the magazine or its staff", () => {
    expect(usernameProblem("postscript")).not.toBeNull();
    expect(usernameProblem("admin_ekip")).not.toBeNull();
    expect(usernameProblem("anonim")).not.toBeNull();
    // Only an exact word or its prefix form is reserved
    expect(usernameProblem("editoryal")).toBeNull();
  });
});

describe("searching members by handle (D-186)", () => {
  it("keeps only what a handle can contain", () => {
    expect(usernameSearchTerm("  @Lunae ")).toBe("lunae");
    expect(usernameSearchTerm("velvet luna!")).toBe("velvetluna");
    expect(usernameSearchTerm("%_")).toBe("_");
  });

  it("escapes the LIKE wildcard a handle may contain", () => {
    expect(usernameSearchPattern("ada_y")).toBe("%ada\\_y%");
  });

  it("puts the exact handle first, then prefixes, then the rest", () => {
    const rows = [{ username: "kara_lunae" }, { username: "lunae_b" }, { username: "lunae" }, { username: "lunaea" }];
    expect(rankUsernameMatches(rows, "lunae").map((row) => row.username)).toEqual([
      "lunae",
      "lunae_b",
      "lunaea",
      "kara_lunae",
    ]);
  });
});
