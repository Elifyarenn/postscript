/**
 * The natural size of an image, read from its own header (D-236).
 *
 * A page's clickable areas are stored as fractions of the picture, so the
 * picture's proportions are part of the record: a replacement that is a
 * different shape moves everything drawn on it, and the panel has to say so.
 *
 * Read by hand rather than with an image library: the three formats the panel
 * accepts all carry their size in the first few dozen bytes, and the project
 * already refuses to take on a dependency for something this small.
 */

export type ImageSize = { width: number; height: number };

function png(buffer: Buffer): ImageSize | null {
  // 8 byte signature, then an IHDR chunk whose first two fields are the size
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(12) !== 0x49484452) return null; // "IHDR"
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpeg(buffer: Buffer): ImageSize | null {
  // Walk the marker segments until one of the frame headers, which carries
  // the size. Anything else is skipped by its own declared length.
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1]!;

    // Standalone markers carry no length at all
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    // SOF0..SOF15, except the four that are not frame headers
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webp(buffer: Buffer): ImageSize | null {
  // "RIFF" .... "WEBP" then one of three chunk layouts
  const chunk = buffer.subarray(12, 16).toString("ascii");

  if (chunk === "VP8 " && buffer.length >= 30) {
    // Lossy: a 3 byte start code, then 14 bit width and height
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    // Lossless: 14 bits each, packed across four bytes after the signature
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && buffer.length >= 30) {
    // Extended: 24 bit values, each stored one less than the real size
    const read24 = (at: number) => buffer[at]! | (buffer[at + 1]! << 8) | (buffer[at + 2]! << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  return null;
}

/** The size in pixels, or null when the bytes do not say. */
export function imageSize(buffer: Buffer, mime: string): ImageSize | null {
  try {
    const size =
      mime === "image/png"
        ? png(buffer)
        : mime === "image/jpeg"
          ? jpeg(buffer)
          : mime === "image/webp"
            ? webp(buffer)
            : null;
    // A zero or a negative would divide badly everywhere downstream
    if (!size || size.width <= 0 || size.height <= 0) return null;
    return size;
  } catch {
    // A truncated file reads past its end; that is "unknown", not a crash
    return null;
  }
}

/**
 * Whether two pictures are close enough in shape that the areas drawn on the
 * first still sit where they were meant to. One percent covers the rounding a
 * re-export introduces without covering a genuinely different crop.
 */
export function sameAspect(a: ImageSize | null, b: ImageSize | null): boolean {
  if (!a || !b) return true; // nothing known: nothing to warn about
  return Math.abs(a.width / a.height - b.width / b.height) <= 0.01;
}
