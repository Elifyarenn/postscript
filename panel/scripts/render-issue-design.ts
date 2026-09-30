/**
 * Draws the pages a design manifest lists into WebP files (D-274).
 *
 *   pnpm render-issue-design -- --source <folder with the .ai files>
 *   pnpm render-issue-design -- --source <folder> --only on-kapak,arka-kapak
 *   pnpm render-issue-design -- --issue 1 --source <folder>
 *
 * Illustrator saves a PDF-compatible copy inside every .ai file; MuPDF draws
 * that copy. The .ai files are only read, never written. The output goes to
 * `assets/issue-design/<folder>/`, with `renders.json` recording which file
 * and page every picture came from. Nothing here touches a database or a
 * bucket, and no path of this computer is written anywhere: only file names.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import sharp from "sharp";
import { DESIGNS } from "@/lib/issue-design";
import { assetFileName, manifestProblems, renderListSchema, type RenderRecord } from "@/lib/issue-design/manifest";
import { MAX_PAGE_IMAGE_BYTES } from "@/lib/page-image";

/** High enough that small type stays sharp at the reader's 4× zoom. */
const QUALITIES = [92, 88, 84, 80];
/** Under the service's limit with room to spare (D-254). */
const MAX_BYTES = Math.floor(MAX_PAGE_IMAGE_BYTES * 0.9);

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

function sha256(buffer: Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  const issueNumber = Number(argument("issue") ?? "1");
  const manifest = DESIGNS.find((entry) => entry.issueNumber === issueNumber);
  if (!manifest) throw new Error(`Sayı ${issueNumber} için manifest yok.`);

  const source = argument("source");
  if (!source || !existsSync(source)) throw new Error("--source ile .ai dosyalarının klasörünü verin.");
  const only = argument("only")?.split(",").map((key) => key.trim()) ?? null;

  const problems = manifestProblems(manifest);
  if (problems.length) throw new Error(problems.join("\n"));

  const outDir = path.join(process.cwd(), "assets", "issue-design", manifest.folder);
  mkdirSync(outDir, { recursive: true });
  const recordFile = path.join(outDir, "renders.json");
  const previous: RenderRecord[] = existsSync(recordFile)
    ? renderListSchema.parse(JSON.parse(readFileSync(recordFile, "utf8")))
    : [];

  const documents = new Map<string, { doc: mupdf.Document; sha: string }>();
  const open = (name: string) => {
    const known = documents.get(name);
    if (known) return known;
    // Read into memory; the file on disk is never opened for writing
    const bytes = readFileSync(path.join(source, name));
    const entry = { doc: mupdf.Document.openDocument(bytes, "application/pdf"), sha: sha256(bytes) };
    documents.set(name, entry);
    return entry;
  };

  const records: RenderRecord[] = [];
  for (const page of manifest.pages) {
    if (only && !only.includes(page.key)) {
      const kept = previous.find((row) => row.key === page.key);
      if (kept) records.push(kept);
      continue;
    }

    const { doc, sha } = open(page.source);
    if (page.sourcePage > doc.countPages()) {
      throw new Error(`${page.source} dosyasında ${page.sourcePage}. sayfa yok (${doc.countPages()} sayfa).`);
    }
    const drawn = doc.loadPage(page.sourcePage - 1);
    const [x0, y0, x1, y1] = drawn.getBounds();
    const scale = manifest.renderWidth / (x1 - x0);
    // Opaque, on white, as the page prints; alpha would only add bytes
    const pixmap = drawn.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
    const { x: trimX, y: trimY } = manifest.trim;
    const width = pixmap.getWidth() - 2 * trimX;
    const height = pixmap.getHeight() - 2 * trimY;
    const png = await sharp(Buffer.from(pixmap.asPNG()))
      .extract({ left: trimX, top: trimY, width, height })
      .png()
      .toBuffer();

    let webp: Buffer | null = null;
    let quality = 0;
    for (quality of QUALITIES) {
      webp = await sharp(png).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      if (webp.length <= MAX_BYTES) break;
    }
    if (!webp || webp.length > MAX_BYTES) throw new Error(`${page.key} ${MAX_BYTES} baytın altına sığmadı.`);

    const file = assetFileName(page.key);
    writeFileSync(path.join(outDir, file), webp);
    records.push({
      key: page.key,
      source: page.source,
      sourcePage: page.sourcePage,
      sourceSha256: sha,
      file,
      width,
      height,
      bytes: webp.length,
      sha256: sha256(webp),
      quality,
    });
    console.log(
      `${page.key}: ${page.source}#${page.sourcePage} → ${file} ${width}×${height} ` +
        `${(webp.length / 1024 / 1024).toFixed(2)} MB (q${quality}, ${Math.round(y1 - y0)}pt tall)`,
    );
  }

  writeFileSync(recordFile, `${JSON.stringify(records, null, 2)}\n`);
  const left = manifestProblems(manifest, records);
  if (left.length) throw new Error(left.join("\n"));
  console.log(`${records.length} sayfa kaydı: ${path.relative(process.cwd(), recordFile)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
