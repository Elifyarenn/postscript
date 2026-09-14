import { describe, expect, it } from "vitest";
import { countChanges, diffLines, DIFF_CELL_BUDGET, foldUnchanged } from "@/lib/text-diff";

describe("diffLines", () => {
  it("marks nothing when the texts are equal", () => {
    const lines = diffLines("a\nb\nc", "a\nb\nc")!;
    expect(lines.every((line) => line.kind === "same")).toBe(true);
    expect(countChanges(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("finds a changed line in the middle as one removal and one addition", () => {
    const lines = diffLines("## Giriş\nEski cümle.\nSon", "## Giriş\nYeni cümle.\nSon")!;
    expect(lines).toEqual([
      { kind: "same", text: "## Giriş" },
      { kind: "removed", text: "Eski cümle." },
      { kind: "added", text: "Yeni cümle." },
      { kind: "same", text: "Son" },
    ]);
  });

  it("handles lines added at the end and removed at the start", () => {
    expect(countChanges(diffLines("a\nb", "a\nb\nc\nd")!)).toEqual({ added: 2, removed: 0 });
    expect(countChanges(diffLines("x\na\nb", "a\nb")!)).toEqual({ added: 0, removed: 1 });
  });

  it("treats Windows line endings like Unix ones", () => {
    expect(countChanges(diffLines("a\r\nb", "a\nb")!)).toEqual({ added: 0, removed: 0 });
  });

  it("rebuilds the new text from its same and added lines", () => {
    const before = "bir\niki\nüç\ndört\nbeş";
    const after = "bir\nüç\nyeni\ndört\nbeş\naltı";
    const rebuilt = diffLines(before, after)!
      .filter((line) => line.kind !== "removed")
      .map((line) => line.text)
      .join("\n");
    expect(rebuilt).toBe(after);
  });

  it("declines to compare texts above the cell budget", () => {
    const side = Math.ceil(Math.sqrt(DIFF_CELL_BUDGET)) + 1;
    const before = Array.from({ length: side }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: side }, (_, i) => `b${i}`).join("\n");
    expect(diffLines(before, after)).toBeNull();
  });
});

describe("foldUnchanged", () => {
  it("keeps the context around a change and folds the long unchanged runs", () => {
    const before = Array.from({ length: 20 }, (_, i) => `satır ${i}`).join("\n");
    const after = before.replace("satır 10", "değişti");
    const items = foldUnchanged(diffLines(before, after)!, 2);

    expect(items[0]).toEqual({ kind: "skipped", count: 8 });
    expect(items.filter((item) => item.kind === "removed")).toHaveLength(1);
    expect(items.filter((item) => item.kind === "added")).toHaveLength(1);
    expect(items.at(-1)).toEqual({ kind: "skipped", count: 7 });
  });

  it("folds everything when nothing changed", () => {
    expect(foldUnchanged(diffLines("a\nb\nc", "a\nb\nc")!)).toEqual([{ kind: "skipped", count: 3 }]);
  });
});
