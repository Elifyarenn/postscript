/**
 * Text pasted from Word gets a blank line between its paragraphs (D-251).
 */
import { describe, expect, it } from "vitest";
import { splitIntoParagraphs } from "@/lib/pasted-paragraphs";

describe("splitIntoParagraphs", () => {
  it("turns Word's single line breaks into paragraph breaks", () => {
    expect(splitIntoParagraphs("Birinci paragraf.\r\nİkinci paragraf.\r\nÜçüncü.")).toBe(
      "Birinci paragraf.\n\nİkinci paragraf.\n\nÜçüncü.",
    );
  });

  it("leaves text that already has blank lines as it is", () => {
    const text = "Birinci.\n\nİkinci.";
    expect(splitIntoParagraphs(text)).toBe(text);
  });

  it("collapses several empty Word paragraphs into one blank line", () => {
    expect(splitIntoParagraphs("Bir.\r\n\r\n\r\n\r\nİki.")).toBe("Bir.\n\nİki.");
  });

  it("keeps list items together and turns Word bullets into markdown", () => {
    expect(splitIntoParagraphs("Giriş:\n•\tElma\n·\tArmut\nSon.")).toBe(
      "Giriş:\n\n- Elma\n- Armut\n\nSon.",
    );
    expect(splitIntoParagraphs("1. Bir\n2. İki")).toBe("1. Bir\n2. İki");
  });

  it("keeps quote lines and table rows together", () => {
    expect(splitIntoParagraphs("> bir\n> iki\nMetin")).toBe("> bir\n> iki\n\nMetin");
    expect(splitIntoParagraphs("| a | b |\n| - | - |\n| 1 | 2 |")).toBe("| a | b |\n| - | - |\n| 1 | 2 |");
  });

  it("does not touch the inside of a code block", () => {
    expect(splitIntoParagraphs("Önce\n```\nx\n\ny\n```\nSonra")).toBe(
      "Önce\n\n```\nx\n\ny\n```\n\nSonra",
    );
  });

  it("drops indentation, trailing spaces and surrounding empty lines", () => {
    expect(splitIntoParagraphs("\n\tBir.   \n    İki.\n\n")).toBe("Bir.\n\nİki.");
    expect(splitIntoParagraphs("- a\n  - b")).toBe("- a\n  - b");
  });

  it("is safe to run twice", () => {
    const once = splitIntoParagraphs("Bir.\nİki.\n•\tÜç\n•\tDört");
    expect(splitIntoParagraphs(once)).toBe(once);
  });
});
