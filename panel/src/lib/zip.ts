/**
 * A minimal ZIP writer for downloads (D-194).
 *
 * Only what a bundle of PNGs needs: stored entries (PNG is already
 * compressed, deflating it again gains nothing), UTF-8 names, no ZIP64. It
 * yields the archive piece by piece, so a route can stream a large bundle
 * instead of holding it in memory or hitting the function's response limit.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array; modified?: Date };

/** MS-DOS time and date, the only timestamp the basic ZIP header has. */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const UTF8_FLAG = 0x0800;

/**
 * Writes the entries as a ZIP. Entries arrive one at a time from `source`, so
 * the caller may load each file just before it is written.
 */
export async function* zipStream(source: AsyncIterable<ZipEntry> | Iterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;

  for await (const entry of source) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const { time, day } = dosDateTime(entry.modified ?? new Date());
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true); // version made by
    header.setUint16(6, 20, true);
    header.setUint16(8, UTF8_FLAG, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, time, true);
    header.setUint16(14, day, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, size, true);
    header.setUint32(24, size, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);
    central.push(new Uint8Array(header.buffer), name);

    yield new Uint8Array(local.buffer);
    yield name;
    yield entry.data;
    offset += 30 + name.length + size;
    count += 1;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  for (const part of central) yield part;

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, count, true);
  end.setUint16(10, count, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  yield new Uint8Array(end.buffer);
}

/** The whole archive in one buffer; for tests and small bundles. */
export async function zipToBuffer(entries: Iterable<ZipEntry>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const part of zipStream(entries)) parts.push(part);
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}

/** Keeps names unique inside one archive: "ada-avatar.png", "ada-avatar-2.png". */
export function uniqueEntryNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)}-${count}${name.slice(dot)}` : `${name}-${count}`;
  });
}
