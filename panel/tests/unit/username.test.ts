import { describe, expect, it } from "vitest";
import { normalizeUsername, usernameProblem } from "@/lib/username";

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
