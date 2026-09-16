/**
 * The community nickname's rules (D-163).
 */
import { describe, expect, it } from "vitest";
import { communityName, NICKNAME_MAX, nicknameProblem, normalizeNickname } from "@/lib/nickname";
import { readsAsStaff } from "@/lib/username";

describe("normalizeNickname", () => {
  it("trims and collapses spaces, and turns an empty name into none", () => {
    expect(normalizeNickname("  Deniz   Su  ")).toBe("Deniz Su");
    expect(normalizeNickname("   ")).toBeNull();
    expect(normalizeNickname("")).toBeNull();
  });
});

describe("nicknameProblem", () => {
  it("accepts ordinary names, Turkish letters and emoji", () => {
    expect(nicknameProblem("Deniz Su")).toBeNull();
    expect(nicknameProblem("Çağla Öztürk")).toBeNull();
    expect(nicknameProblem("kitap kurdu 📚")).toBeNull();
    expect(nicknameProblem(null)).toBeNull();
  });

  it("counts characters, not UTF-16 units, against the limit", () => {
    expect(nicknameProblem("📚".repeat(NICKNAME_MAX))).toBeNull();
    expect(nicknameProblem("a".repeat(NICKNAME_MAX + 1))).toMatch(/en fazla/);
  });

  it("refuses invisible and direction-changing characters", () => {
    expect(nicknameProblem("Deniz​")).toMatch(/görünmeyen/);
    expect(nicknameProblem("‮İmza")).toMatch(/görünmeyen/);
  });

  it("refuses names that read as the magazine or its staff", () => {
    expect(nicknameProblem("Postscript")).toMatch(/çağrıştırıyor/);
    expect(nicknameProblem("Post Script")).toMatch(/çağrıştırıyor/);
    expect(nicknameProblem("YÖNETİM")).toMatch(/çağrıştırıyor/);
    expect(nicknameProblem("Editör Ayşe")).toMatch(/çağrıştırıyor/);
  });
});

describe("readsAsStaff", () => {
  it("needs a whole word, so ordinary words that start the same are fine", () => {
    expect(readsAsStaff("Yazarlık tutkunu")).toBe(false);
    expect(readsAsStaff("Rootsy")).toBe(false);
    expect(readsAsStaff("Yazar")).toBe(true);
  });
});

describe("communityName", () => {
  it("shows the nickname, or the handle without one", () => {
    expect(communityName({ username: "deniz_su", nickname: "Deniz" })).toBe("Deniz");
    expect(communityName({ username: "deniz_su", nickname: null })).toBe("deniz_su");
  });
});
