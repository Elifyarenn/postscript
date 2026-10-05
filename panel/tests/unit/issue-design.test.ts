/**
 * The designed pages kept in code (D-274): the manifest's rules, and the real
 * manifest against the real pictures that ship with the deployment.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESIGNS, designFor } from "@/lib/issue-design";
import {
  designKeyOf,
  designLabel,
  designManifestSchema,
  designOrder,
  designStorageKey,
  manifestProblems,
  renderListSchema,
  type DesignManifest,
  type DesignQuizPage,
} from "@/lib/issue-design/manifest";
import { OBSESSION_QUIZ } from "@/lib/issue-design/issue-01-quizzes";
import { imageSize } from "@/lib/image-size";
import { MAX_PAGE_IMAGE_BYTES } from "@/lib/page-image";

function page(key: string, extra: Partial<DesignManifest["pages"][number]> = {}): DesignManifest["pages"][number] {
  return {
    key,
    source: "a.ai",
    sourcePage: 1,
    printedNumber: null,
    role: "page",
    title: key,
    contents: null,
    alt: "Sayfa",
    transcript: null,
    areas: [],
    ...extra,
  };
}

function manifest(pages: DesignManifest["pages"]): DesignManifest {
  return { issueNumber: 1, folder: "test", renderWidth: 2480, trim: { x: 0, y: 0 }, pages, excluded: [] };
}

describe("labels and keys", () => {
  it("reads the key back from the label it writes", () => {
    expect(designKeyOf(designLabel("bilim-acilis", "Bilim & Teknoloji açılışı"))).toBe("bilim-acilis");
  });

  it("does not take a hand-written label for a design page", () => {
    expect(designKeyOf("Geçici tasarım · Kapak")).toBeNull();
    expect(designKeyOf("Deneme sayfası 3")).toBeNull();
    expect(designKeyOf(null)).toBeNull();
  });

  it("derives the storage key from the content, so the same picture lands on the same object", () => {
    const sha = "a".repeat(64);
    expect(designStorageKey("sayi-01", "on-kapak", sha)).toBe("issue-pages/design/sayi-01/on-kapak-aaaaaaaaaaaaaaaa.webp");
    expect(designStorageKey("sayi-01", "on-kapak", "b".repeat(64))).not.toBe(designStorageKey("sayi-01", "on-kapak", sha));
  });
});

describe("what a manifest may not say", () => {
  it("refuses a path instead of a file name", () => {
    const parsed = designManifestSchema.safeParse(manifest([page("a", { source: "C:/Users/x/a.ai" })]));
    expect(parsed.success).toBe(false);
  });

  it("refuses an area that leaves the page and a link that is not http", () => {
    const outside = { kind: "info" as const, name: "x", rect: [0.9, 0.1, 0.2, 0.1] as [number, number, number, number], title: "t", body: "b" };
    expect(designManifestSchema.safeParse(manifest([page("a", { areas: [outside] })])).success).toBe(false);
    const script = { kind: "link" as const, name: "x", rect: [0, 0, 0.1, 0.1] as [number, number, number, number], url: "javascript:alert(1)" };
    expect(designManifestSchema.safeParse(manifest([page("a", { areas: [script] })])).success).toBe(false);
  });

  it("finds a repeated key, a repeated source page and a jump to nowhere", () => {
    const jump = { kind: "page" as const, name: "Git", rect: [0, 0, 0.1, 0.1] as [number, number, number, number], target: "yok" };
    const problems = manifestProblems(
      manifest([page("a", { areas: [jump] }), page("a", { sourcePage: 2 }), page("b")]),
    );
    expect(problems.join("\n")).toMatch(/iki kez kullanılmış/);
    expect(problems.join("\n")).toMatch(/1\. sayfası iki kez/);
    expect(problems.join("\n")).toMatch(/olmayan bir sayfaya/);
  });

  it("asks for a redraw when the picture came from another source page", () => {
    const records = [
      { key: "a", source: "a.ai", sourcePage: 2, sourceSha256: "0".repeat(64), file: "a.webp", width: 1, height: 1, bytes: 1, sha256: "0".repeat(64), quality: 90 },
    ];
    expect(manifestProblems(manifest([page("a")]), records).join("")).toMatch(/yeniden üretin/);
    expect(manifestProblems(manifest([page("a"), page("b", { sourcePage: 3 })]), records).join("")).toMatch(/üretilmemiş/);
  });
});

describe("a quiz as a page of its own (D-309)", () => {
  const quizPage = (extra: Partial<DesignQuizPage> = {}): DesignQuizPage => ({
    key: "test",
    after: "a",
    title: "Test",
    contents: "Test",
    section: null,
    quizTitle: OBSESSION_QUIZ.title,
    ...extra,
  });
  const withQuiz = (pages: DesignManifest["pages"], quizPages: DesignQuizPage[]): DesignManifest => ({
    ...manifest(pages),
    quizzes: [OBSESSION_QUIZ],
    quizPages,
  });

  it("stands right after the page it names, the pictures keeping their own order", () => {
    const shape = withQuiz([page("a"), page("b", { sourcePage: 2 })], [quizPage()]);
    expect(manifestProblems(shape)).toEqual([]);
    expect(designOrder(shape)).toEqual(["a", "test", "b"]);
    expect(designOrder(manifest([page("a")]))).toEqual(["a"]);
  });

  it("refuses a page after nowhere, a key a picture already has, and a quiz the manifest does not carry", () => {
    const problems = manifestProblems(
      withQuiz([page("a")], [quizPage({ after: "yok" }), quizPage({ key: "a" }), quizPage({ key: "c", quizTitle: "Olmayan" })]),
    ).join("\n");
    expect(problems).toMatch(/olmayan bir sayfanın ardına/);
    expect(problems).toMatch(/"a" anahtarı iki kez/);
    expect(problems).toMatch(/testi manifestte yok/);
  });

  it("does not let two test pages follow the same page", () => {
    const problems = manifestProblems(withQuiz([page("a")], [quizPage(), quizPage({ key: "test-2" })]));
    expect(problems.join("")).toMatch(/birden çok test sayfası/);
  });
});

describe("issue 01 as shipped", () => {
  const issue = designFor(1)!;
  const folder = path.join(process.cwd(), "assets", "issue-design", issue.folder);
  const renders = renderListSchema.parse(JSON.parse(readFileSync(path.join(folder, "renders.json"), "utf8")));

  it("is registered once and has no problems", () => {
    expect(DESIGNS.filter((entry) => entry.issueNumber === 1)).toHaveLength(1);
    expect(manifestProblems(issue, renders)).toEqual([]);
  });

  it("shows the obsession quiz as the page after the Eğlence & Dedikodu opener, with no hidden area left", () => {
    const order = designOrder(issue);
    expect(order[order.indexOf("eglence-dedikodu-acilis") + 1]).toBe("eglence-dedikodu-test");
    expect(issue.quizPages?.[0]?.quizTitle).toBe(OBSESSION_QUIZ.title);
    expect(issue.pages.flatMap((entry) => entry.areas).filter((area) => area.kind === "quiz")).toEqual([]);
  });

  it("starts with the front cover and ends with the back cover", () => {
    expect(issue.pages[0]!.role).toBe("cover");
    expect(issue.pages.at(-1)!.role).toBe("back_cover");
  });

  it("keeps the front matter in the order set in the panel, the memorial page drawn once (D-324)", () => {
    expect(issue.pages.slice(0, 5).map((entry) => entry.key)).toEqual(["on-kapak", "anma", "sunus", "icindekiler-1", "icindekiler-2"]);
    expect(issue.pages[1]!.omitTextObjects).toEqual([3, 4]);
  });

  it("keeps the science section in printed order 04 → 09", () => {
    const science = issue.pages.filter((entry) => entry.source === "POSTSCRIPT bilim.ai").map((entry) => entry.printedNumber);
    expect(science).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("puts the numbered sections in printed order, 16 to 69 without a gap (D-323)", () => {
    const from = issue.pages.findIndex((entry) => entry.key === "film-dizi-kitap-acilis");
    const numbers = issue.pages.slice(from, -1).map((entry) => entry.printedNumber);
    expect(numbers).toEqual(Array.from({ length: 54 }, (_, index) => 16 + index));
  });

  it("gives every written page its text", () => {
    for (const entry of issue.pages.filter((page) => /^(bilim|psikoloji)-/.test(page.key))) {
      expect(entry.transcript?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("uses every page of the twelve delivered files, the empty ones too (D-323)", () => {
    expect(issue.excluded).toEqual([]);
    expect(issue.pages).toHaveLength(72);
    const files = new Set(issue.pages.map((entry) => entry.source));
    expect(files.size).toBe(12);
    for (const file of files) {
      const pages = issue.pages.filter((entry) => entry.source === file).map((entry) => entry.sourcePage);
      expect(pages.sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("ships every picture, the same bytes renders.json names, one shape, under the upload limit", () => {
    const shapes = new Set<string>();
    for (const record of renders) {
      const file = path.join(folder, record.file);
      expect(existsSync(file)).toBe(true);
      const bytes = readFileSync(file);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
      expect(bytes.length).toBeLessThanOrEqual(MAX_PAGE_IMAGE_BYTES);
      const size = imageSize(bytes, "image/webp");
      expect(size).toEqual({ width: record.width, height: record.height });
      shapes.add(`${record.width}x${record.height}`);
    }
    // One shape, so a spread lines up and nothing jumps between pages
    expect(shapes.size).toBe(1);
  });

  it("writes no path of the machine it was drawn on", () => {
    const text = readFileSync(path.join(folder, "renders.json"), "utf8");
    expect(text).not.toMatch(/[A-Za-z]:[\\/]|\/Users\/|\\\\/);
  });
});
