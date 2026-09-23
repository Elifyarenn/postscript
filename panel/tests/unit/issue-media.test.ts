/**
 * Reading a picture's size, and the geometry of the areas drawn on it (D-240).
 */
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { imageSize, sameAspect } from "@/lib/image-size";
import {
  clampRect,
  hotspotIsReady,
  hotspotProblem,
  overlapArea,
  overlappingPairs,
  safeExternalUrl,
} from "@/lib/issue-hotspots";

/* ------------------------------------------------------------------ */
/* Files just real enough to be read                                   */
/* ------------------------------------------------------------------ */

function pngHeader(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const length = Buffer.alloc(4);
  length.writeUInt32BE(13, 0);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    length,
    Buffer.from("IHDR", "ascii"),
    ihdr,
    Buffer.alloc(4),
    deflateSync(Buffer.alloc(8)),
  ]);
}

function jpegHeader(width: number, height: number): Buffer {
  const frame = Buffer.alloc(11);
  frame[0] = 0xff;
  frame[1] = 0xc0;
  frame.writeUInt16BE(9, 2); // segment length
  frame[4] = 8; // precision
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), frame, Buffer.alloc(8)]);
}

function webpLossy(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(40);
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8 ", 12, "ascii");
  buffer.writeUInt16LE(width, 26);
  buffer.writeUInt16LE(height, 28);
  return buffer;
}

describe("the size of a page picture", () => {
  it("reads a PNG, a JPEG and a WEBP header", () => {
    expect(imageSize(pngHeader(1240, 1754), "image/png")).toEqual({ width: 1240, height: 1754 });
    expect(imageSize(jpegHeader(800, 1200), "image/jpeg")).toEqual({ width: 800, height: 1200 });
    expect(imageSize(webpLossy(640, 480), "image/webp")).toEqual({ width: 640, height: 480 });
  });

  it("says nothing rather than guessing when the bytes do not", () => {
    expect(imageSize(Buffer.alloc(4), "image/png")).toBeNull();
    expect(imageSize(pngHeader(1240, 1754), "image/gif")).toBeNull();
    // A zero would divide badly in every place a size is used
    expect(imageSize(pngHeader(0, 100), "image/png")).toBeNull();
  });

  it("calls a re-export the same shape but a different crop a different one", () => {
    const before = { width: 1240, height: 1754 };
    expect(sameAspect(before, { width: 1241, height: 1755 })).toBe(true);
    expect(sameAspect(before, { width: 1754, height: 1240 })).toBe(false);
    // Nothing known means nothing to warn about
    expect(sameAspect(null, before)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* The areas                                                           */
/* ------------------------------------------------------------------ */

describe("an area's address", () => {
  it("takes http and https and nothing else", () => {
    expect(safeExternalUrl("https://open.spotify.com/x")).toBe("https://open.spotify.com/x");
    expect(safeExternalUrl(" http://example.test ")).toBe("http://example.test/");
    // Anything that could run in the reader's browser is refused here, once
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(safeExternalUrl("/magazine/issues/1")).toBeNull();
    expect(safeExternalUrl("")).toBeNull();
  });
});

describe("whether an area does anything", () => {
  it("wants a real target for each kind", () => {
    expect(hotspotIsReady({ kind: "link", url: "https://example.test" })).toBe(true);
    expect(hotspotIsReady({ kind: "link", url: "javascript:x" })).toBe(false);
    expect(hotspotIsReady({ kind: "page", targetPageId: null })).toBe(false);
    expect(hotspotIsReady({ kind: "page", targetPageId: "abc" })).toBe(true);
    expect(hotspotIsReady({ kind: "info", infoTitle: "", infoBody: "  " })).toBe(false);
    expect(hotspotIsReady({ kind: "info", infoBody: "Bir not" })).toBe(true);
    expect(hotspotIsReady({ kind: "quiz", quizId: null })).toBe(false);
  });

  it("says what is missing in words the panel can print", () => {
    expect(hotspotProblem({ kind: "quiz", quizId: null })).toMatch(/test/i);
    expect(hotspotProblem({ kind: "link", url: "https://example.test" })).toBeNull();
  });
});

describe("rectangles on a page", () => {
  it("keeps a dragged area inside the picture", () => {
    expect(clampRect({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 })).toEqual({
      x: 0.7,
      y: 0.7,
      w: 0.3,
      h: 0.3,
    });
    expect(clampRect({ x: -0.2, y: -0.5, w: 0.2, h: 0.2 })).toEqual({
      x: 0,
      y: 0,
      w: 0.2,
      h: 0.2,
    });
  });

  it("counts a shared edge as no overlap and a shared patch as one", () => {
    const a = { x: 0, y: 0, w: 0.4, h: 0.4 };
    const touching = { x: 0.4, y: 0, w: 0.4, h: 0.4 };
    const over = { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };

    expect(overlapArea(a, touching)).toBe(0);
    expect(overlapArea(a, over)).toBeCloseTo(0.01, 5);
    expect(overlappingPairs([a, touching])).toEqual([]);
    expect(overlappingPairs([a, touching, over])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });
});
