/**
 * The preview's text fitting and page geometry (D-247). The words on a page
 * are the writer's own: cut only at the end, never reworded, and an area is
 * always inside the page it is drawn on.
 */
import { describe, expect, it } from "vitest";
import {
  collagePage,
  contentsPage,
  continuedPage,
  coverPage,
  openingPage,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  picksPage,
  secondArticlePage,
  toFractions,
  type DrawnPage,
} from "@/lib/issue-preview/pages";
import { renderPagePng } from "@/lib/issue-preview/render";
import { STOCK } from "@/lib/issue-preview/stock";
import { capacity, fitParagraphs, paragraphsOf, pickQuote, sameTitle } from "@/lib/issue-preview/text";
import { imageSize } from "@/lib/image-size";

describe("matching a draft by its title", () => {
  it("ignores case, Turkish letters' marks and punctuation", () => {
    expect(sameTitle("ÜÇ KALEM", "Üç Kalem")).toBe(true);
    expect(sameTitle("Madde 1 – Hukukun Peşini Bırakmadıkları", "Madde 1 - Hukukun Peşini Bırakmadıkları")).toBe(true);
  });

  it("accepts a subtitle, but not a short stem", () => {
    expect(sameTitle("Bilim İnsanları ve Obsesyon: bir not", "Bilim İnsanları ve Obsesyon")).toBe(true);
    expect(sameTitle("Üç Kalem ve Bir Mektup", "Üç")).toBe(false);
  });
});

describe("fitting the writer's words", () => {
  const box = { width: 505, height: 600, fontSize: 27, lineHeight: 1.55 };

  it("takes whole paragraphs in order, unchanged, while they fit", () => {
    const source = ["Birinci paragraf.", "İkinci paragraf.", "Üçüncü paragraf."];
    const fitted = fitParagraphs(source, 0, box);
    expect(fitted).toEqual({ paragraphs: source, used: 3, complete: true });
  });

  it("cuts the last one at a sentence and marks it, never beyond the box", () => {
    const sentence = "Bu cümle uzun bir paragrafın parçasıdır ve kendini tekrar eder. ";
    const source = [sentence.repeat(40)];
    const fitted = fitParagraphs(source, 0, box);
    expect(fitted.complete).toBe(false);
    expect(fitted.paragraphs[0]!.endsWith("…")).toBe(true);
    expect(fitted.paragraphs[0]!.length).toBeLessThanOrEqual(capacity(box) + 2);
    // What is kept is a prefix of the original, word for word
    expect(source[0]!.startsWith(fitted.paragraphs[0]!.replace(/ …$/, ""))).toBe(true);
  });

  it("reads markdown down to plain paragraphs", () => {
    expect(paragraphsOf("# Başlık\n\nBir **kalın** ve [bağlantı](https://x.y).\nAynı paragraf.")).toEqual([
      "Başlık",
      "Bir kalın ve bağlantı. Aynı paragraf.",
    ]);
  });

  it("quotes a whole sentence of the text, never a made-up one", () => {
    const text = "Kısa. Bu, alıntı olarak seçilecek kadar uzun ama sayfaya sığacak kadar kısa olan bir cümledir. Son.";
    const quote = pickQuote([text]);
    expect(quote).not.toBeNull();
    expect(text).toContain(quote!);
  });
});

describe("the page designs", () => {
  const issue = { number: 1, title: "Obsession", theme: "Bırakamadıklarımız" };
  const article = {
    title: "Başlık",
    byline: "Mahlas",
    category: "Bilim & Teknoloji",
    paragraphs: Array.from({ length: 12 }, () => "Bir cümle daha. ".repeat(20)),
  };
  const photo = { src: "data:image/jpeg;base64,", credit: "Fotoğraf: X / Unsplash", description: "x" };
  const info = { title: "t", body: "b" };
  const playlist = { name: "Obsession", url: "https://open.spotify.com/playlist/x" };

  const pages: DrawnPage[] = [
    coverPage({ issue, featured: [article] }),
    contentsPage({
      issue,
      number: 2,
      playlist,
      entries: [{ target: "opening", page: 3, kicker: "BİLİM", title: "Başlık", byline: "Mahlas" }],
    }),
    openingPage({ issue, number: 3, article, photo, photoInfo: info }),
    continuedPage({ issue, number: 4, article, from: 1, photo, noteInfo: info }),
    secondArticlePage({ issue, number: 5, article, photo, photoInfo: info }),
    collagePage({ issue, number: 6, article, photos: [photo, photo, photo], photoInfo: info }),
    picksPage({ issue, number: 7, playlist, picks: [] }),
  ];

  it("keeps every clickable area inside its page", () => {
    for (const page of pages) {
      for (const area of page.areas) {
        const f = toFractions(area.rect);
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.y).toBeGreaterThanOrEqual(0);
        expect(f.x + f.w).toBeLessThanOrEqual(1);
        expect(f.y + f.h).toBeLessThanOrEqual(1);
      }
    }
  });

  it("says on every page that it is a temporary, unpublished design", () => {
    for (const page of pages) expect(page.transcript).toContain("GEÇİCİ TASARIM — YAYIMLANMADI");
  });

  it("marks a shortened text as a preview selection", () => {
    for (const page of pages.slice(2, 6)) expect(page.transcript).toContain("Önizleme seçkisi");
  });

  it("uses only photos whose source and licence are on record", () => {
    for (const photo of Object.values(STOCK)) {
      expect(photo.source).toMatch(/^https:\/\/(unsplash\.com|www\.pexels\.com)\//);
      expect(photo.photographer.length).toBeGreaterThan(0);
    }
  });

  it("draws a real A4 page picture", async () => {
    const buffer = await renderPagePng(pages[0]!.element);
    expect(imageSize(buffer, "image/png")).toEqual({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
  }, 60_000);
});
