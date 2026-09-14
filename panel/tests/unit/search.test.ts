import { describe, expect, it } from "vitest";
import { containsPattern } from "@/lib/search";

describe("containsPattern (D-112)", () => {
  it("wraps plain text in wildcards", () => {
    expect(containsPattern("aşk")).toBe("%aşk%");
  });

  it("takes the reader's wildcards and backslashes literally", () => {
    expect(containsPattern("100%")).toBe("%100\\%%");
    expect(containsPattern("a_b")).toBe("%a\\_b%");
    expect(containsPattern("c:\\yol")).toBe("%c:\\\\yol%");
  });
});
