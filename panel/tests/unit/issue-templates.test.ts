/**
 * The layouts an issue is built from and the blocks its pages carry (D-234).
 */
import { describe, expect, it } from "vitest";
import { PAGE_TEMPLATES, templateAsks, templateOf } from "@/lib/issue-templates";
import { blockIsReady, parseBlocks, type PageBlock } from "@/lib/issue-blocks";
import { pageTemplateEnum } from "@/db/schema";

describe("the page layouts", () => {
  it("matches the values the database accepts, one for one", () => {
    // A layout the column cannot hold would fail only when someone used it
    expect([...PAGE_TEMPLATES.map((template) => template.id)].sort()).toEqual(
      [...pageTemplateEnum.enumValues].sort(),
    );
  });

  it("gives every layout a label, a hint and at least one field", () => {
    for (const template of PAGE_TEMPLATES) {
      expect(template.label.trim().length, template.id).toBeGreaterThan(0);
      expect(template.hint.trim().length, template.id).toBeGreaterThan(0);
      expect(template.fields.length, template.id).toBeGreaterThan(0);
    }
  });

  it("falls back to the first layout for something unknown", () => {
    expect(templateOf("poster").id).toBe(PAGE_TEMPLATES[0].id);
  });

  it("asks a full-bleed page for a picture but not for a byline", () => {
    expect(templateAsks("full_bleed", "image")).toBe(true);
    expect(templateAsks("full_bleed", "byline")).toBe(false);
  });

  it("keeps covers and dividers out of the contents by default", () => {
    expect(templateOf("cover").inContentsByDefault).toBe(false);
    expect(templateOf("full_bleed").inContentsByDefault).toBe(false);
    expect(templateOf("editorial").inContentsByDefault).toBe(true);
  });
});

describe("page blocks", () => {
  it("drops anything that no longer parses rather than throwing", () => {
    const blocks = parseBlocks([
      { kind: "quote", text: "Bir cümle", source: "" },
      { kind: "iframe", src: "https://example.test" },
      "nonsense",
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "quote" });
  });

  it("reads a non-array as no blocks at all", () => {
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks({ kind: "quote" })).toEqual([]);
  });

  it("calls a half-filled block unready, so a reader never meets a dead control", () => {
    const cases: [PageBlock, boolean][] = [
      [{ kind: "zoom", mediaId: null, caption: "" }, false],
      [{ kind: "gallery", mediaIds: [], caption: "" }, false],
      [{ kind: "quote", text: "", source: "" }, false],
      [{ kind: "quote", text: "Var", source: "" }, true],
      [{ kind: "media", url: "", media: "audio", title: "" }, false],
      [{ kind: "quiz", question: "Soru?", options: ["A"], answer: 0, explanation: "" }, false],
      [{ kind: "quiz", question: "Soru?", options: ["A", "B"], answer: 0, explanation: "" }, true],
      [{ kind: "playlist" }, true],
    ];
    for (const [block, ready] of cases) {
      expect(blockIsReady(block), block.kind).toBe(ready);
    }
  });
});
