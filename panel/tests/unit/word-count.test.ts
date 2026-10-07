import { describe, expect, it } from "vitest";
import { countWords, formatWordCount } from "@/lib/word-count";
import { wordCount } from "@/lib/contributor-documents";

describe("countWords (D-330)", () => {
  it("counts the words a reader reads", () => {
    expect(countWords("Bir iki üç.")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(countWords("   \n\n  ")).toBe(0);
  });

  it("does not count markdown marks", () => {
    expect(countWords("# Başlık\n\n> **Kalın** ve _eğik_ — `kod`\n\n- madde\n1. sıra")).toBe(7);
    expect(countWords("[bağlantı metni](https://example.com/uzun-adres) ve ![görsel](a.png)")).toBe(3);
    expect(countWords("```\nconst a = 1;\n```\nSonra")).toBe(1);
  });

  it("does not count HTML tags, comments or entities", () => {
    expect(countWords('<p class="x">İki <strong>kelime</strong></p>')).toBe(2);
    expect(countWords("Bir<br/>iki<!-- not -->&nbsp;üç")).toBe(3);
  });

  it("keeps a hyphenated word whole and drops a lone dash", () => {
    expect(countWords("e-posta - adresi")).toBe(2);
  });

  it("is the same count the licence form uses", () => {
    const body = "# Başlık\n\nBir **iki** üç. [dört](https://x.y) — 5";
    expect(wordCount(body)).toBe(countWords(body));
    expect(countWords(body)).toBe(6);
  });

  it("writes the count the Turkish way", () => {
    expect(formatWordCount(1234)).toBe("1.234 kelime");
  });
});
