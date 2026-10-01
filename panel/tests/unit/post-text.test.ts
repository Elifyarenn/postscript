/**
 * The post's text rules (D-294): the 250 limit, "@handle" mentions and the
 * "@" / "ps/" triggers the composer reads at the caret.
 */
import { describe, expect, it } from "vitest";
import { extractMentions, MAX_MENTIONS_PER_POST, MAX_POST_LENGTH, segmentPostBody, tokenAtCaret } from "@/lib/post-text";

describe("post length", () => {
  it("is 250 characters", () => {
    expect(MAX_POST_LENGTH).toBe(250);
  });
});

describe("extractMentions", () => {
  it("finds each handle once, lowercased, in order", () => {
    expect(extractMentions("@Ada ve @bora_k, sonra yine @ada.")).toEqual(["ada", "bora_k"]);
  });

  it("does not read an e-mail address, a too short handle or a handle inside a word", () => {
    expect(extractMentions("yaz: ada@ornek.com, @ab, x@yazar")).toEqual([]);
  });

  it("stops at the per-post limit", () => {
    const body = Array.from({ length: 15 }, (_, index) => `@uye_${index}`).join(" ");
    expect(extractMentions(body)).toHaveLength(MAX_MENTIONS_PER_POST);
  });
});

describe("segmentPostBody", () => {
  it("cuts the text into plain runs and mentions, losing nothing", () => {
    const body = "Merhaba @Ada, (@bora) nasılsın?";
    const segments = segmentPostBody(body);
    expect(segments).toEqual([
      { type: "text", value: "Merhaba " },
      { type: "mention", username: "ada", value: "@Ada" },
      { type: "text", value: ", (" },
      { type: "mention", username: "bora", value: "@bora" },
      { type: "text", value: ") nasılsın?" },
    ]);
    expect(segments.map((segment) => segment.value).join("")).toBe(body);
  });

  it("leaves a post without mentions whole", () => {
    expect(segmentPostBody("düz metin")).toEqual([{ type: "text", value: "düz metin" }]);
  });
});

describe("tokenAtCaret", () => {
  it("reads a member being named", () => {
    const text = "selam @ad";
    expect(tokenAtCaret(text, text.length)).toEqual({ kind: "mention", query: "ad", start: 6, end: 9 });
    expect(tokenAtCaret("@", 1)).toEqual({ kind: "mention", query: "", start: 0, end: 1 });
  });

  it("reads a community being chosen", () => {
    const text = "bakın ps/mod";
    expect(tokenAtCaret(text, text.length)).toEqual({ kind: "community", query: "mod", start: 6, end: 12 });
  });

  it("reads nothing elsewhere: after a space, inside an address, mid-word", () => {
    expect(tokenAtCaret("@ada ", 5)).toBeNull();
    expect(tokenAtCaret("ada@orn", 7)).toBeNull();
    expect(tokenAtCaret("xps/mo", 6)).toBeNull();
  });
});
