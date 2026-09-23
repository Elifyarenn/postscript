/**
 * A very small PNG writer, for neutral test pages (D-240).
 *
 * Used by `sample-issue-pages.ts` to make pages that look like pages — the
 * right proportions, the magazine's paper and wine, a rule and a number — so
 * the panel and the reader can be exercised before any artwork exists. It
 * writes nothing but a number on a page: no invented headline, no invented
 * byline, nothing that could be mistaken for the magazine's own words.
 *
 * Hand written rather than pulled in: the project already refuses a second
 * library for something this size, and an 8-bit RGB PNG is a header, one
 * deflated block of scanlines and an end marker.
 */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([head, typed, crc]);
}

export type Rgb = [number, number, number];

/** A page-sized canvas that can be filled with rectangles and written out. */
export class Canvas {
  readonly pixels: Buffer;

  constructor(
    readonly width: number,
    readonly height: number,
    background: Rgb,
  ) {
    this.pixels = Buffer.alloc(width * height * 3);
    this.fill(0, 0, width, height, background);
  }

  fill(x: number, y: number, w: number, h: number, colour: Rgb): void {
    const left = Math.max(0, Math.round(x));
    const top = Math.max(0, Math.round(y));
    const right = Math.min(this.width, Math.round(x + w));
    const bottom = Math.min(this.height, Math.round(y + h));

    for (let row = top; row < bottom; row += 1) {
      for (let column = left; column < right; column += 1) {
        const at = (row * this.width + column) * 3;
        this.pixels[at] = colour[0];
        this.pixels[at + 1] = colour[1];
        this.pixels[at + 2] = colour[2];
      }
    }
  }

  toPng(): Buffer {
    // One filter byte per scanline, and the filter is "none": the pages are
    // flat colour, so there is nothing for a predictor to win
    const raw = Buffer.alloc(this.height * (this.width * 3 + 1));
    for (let row = 0; row < this.height; row += 1) {
      const from = row * this.width * 3;
      raw[row * (this.width * 3 + 1)] = 0;
      this.pixels.copy(raw, row * (this.width * 3 + 1) + 1, from, from + this.width * 3);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header[8] = 8; // bits per channel
    header[9] = 2; // truecolour
    header[10] = 0; // deflate
    header[11] = 0; // adaptive filtering
    header[12] = 0; // no interlace

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

/** A 5×7 bitmap for each digit; enough to put a page number on a test page. */
const DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

/** Draws a number, left edge at (x, y), each bitmap pixel `scale` across. */
export function drawNumber(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  colour: Rgb,
): void {
  let cursor = x;
  for (const character of text) {
    const glyph = DIGITS[character];
    if (!glyph) {
      cursor += scale * 3;
      continue;
    }
    for (const [row, bits] of glyph.entries()) {
      for (const [column, bit] of [...bits].entries()) {
        if (bit === "1") {
          canvas.fill(cursor + column * scale, y + row * scale, scale, scale, colour);
        }
      }
    }
    cursor += scale * 6;
  }
}
