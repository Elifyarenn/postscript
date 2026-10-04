/**
 * The smaller copies of a design page (D-313): which widths are honoured, how
 * a copy is named, the srcset the reader gets, and that every shipped page
 * has its copies on disk so the import has something to upload.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderListSchema } from "@/lib/issue-design/manifest";
import { PAGE_VARIANT_WIDTHS, pageSrcSet, parseVariantWidth, variantName } from "@/lib/issue-page-variants";

describe("parseVariantWidth", () => {
  it("honours only the listed widths", () => {
    expect(parseVariantWidth("720")).toBe(720);
    expect(parseVariantWidth("1280")).toBe(1280);
    for (const value of [null, "", "0", "721", "2456", "720.0x", "-720", "1e3"]) {
      expect(parseVariantWidth(value)).toBeNull();
    }
  });
});

describe("variantName", () => {
  it("puts the width before the extension, for WebP only", () => {
    expect(variantName("on-kapak.webp", 720)).toBe("on-kapak.w720.webp");
    expect(variantName("issue-pages/design/sayi-01/on-kapak-0123456789abcdef.webp", 1280)).toBe(
      "issue-pages/design/sayi-01/on-kapak-0123456789abcdef.w1280.webp",
    );
    expect(variantName("issue-pages/2026-10-04/x.png", 720)).toBeNull();
  });
});

describe("pageSrcSet", () => {
  it("lists the copies, then the original at its own width", () => {
    expect(pageSrcSet("/api/p/1/media/2", 2456)).toBe(
      "/api/p/1/media/2?w=720 720w, /api/p/1/media/2?w=1280 1280w, /api/p/1/media/2 2456w",
    );
  });

  it("offers no copy wider than the original", () => {
    expect(pageSrcSet("/m", 1000)).toBe("/m?w=720 720w, /m 1000w");
  });
});

describe("the shipped design pages", () => {
  const dir = path.join(process.cwd(), "assets", "issue-design", "sayi-01");
  const renders = renderListSchema.parse(JSON.parse(readFileSync(path.join(dir, "renders.json"), "utf8")));

  it("each have a copy at every width, at that width and the same shape", async () => {
    for (const record of renders) {
      for (const width of PAGE_VARIANT_WIDTHS) {
        const file = path.join(dir, variantName(record.file, width)!);
        expect(existsSync(file), `${record.file} → w${width} (run pnpm issue-design-variants)`).toBe(true);
        const meta = await sharp(file).metadata();
        expect(meta.width).toBe(width);
        expect(Math.abs(meta.height! / width - record.height / record.width)).toBeLessThan(0.01);
      }
    }
  });
});
