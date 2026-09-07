/**
 * The banned word filter: substring matching on Turkish-lowercased text with
 * the first letter of each hit kept and the rest starred.
 */
import { describe, expect, it } from "vitest";
import { maskBannedWords, normalizeBannedWord } from "@/lib/moderation";

describe("normalizeBannedWord", () => {
  it("trims and lowercases in the Turkish locale", () => {
    expect(normalizeBannedWord("  KÜFÜR ")).toBe("küfür");
    expect(normalizeBannedWord("ISTANBUL")).toBe("ıstanbul");
  });
});

describe("maskBannedWords", () => {
  it("leaves clean text alone", () => {
    expect(maskBannedWords("Bu yazı gayet güzel.", ["küfür"])).toBe(
      "Bu yazı gayet güzel.",
    );
  });

  it("stars a banned word, keeping its first letter", () => {
    expect(maskBannedWords("bu bir küfür", ["küfür"])).toBe("bu bir k****");
  });

  it("matches case-insensitively and catches suffixed forms", () => {
    expect(maskBannedWords("KÜFÜR ettin", ["küfür"])).toBe("K**** ettin");
    expect(maskBannedWords("küfürbaz", ["küfür"])).toBe("k****baz");
  });

  it("masks several words and every occurrence", () => {
    const banned = ["küfür", "hakaret"];
    expect(maskBannedWords("küfür ve hakaret, başka küfür", banned)).toBe(
      "k**** ve h******, başka k****",
    );
  });

  it("ignores empty entries in the list", () => {
    expect(maskBannedWords("normal metin", ["  ", ""])).toBe("normal metin");
  });

  it("does not re-match inside its own mask", () => {
    // "küfür" → "k****"; the stars must not be re-scanned as another hit
    expect(maskBannedWords("küfürküfür", ["küfür"])).toBe("k****k****");
  });
});