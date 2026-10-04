/**
 * Makes the smaller copies of every rendered design page (D-313).
 *
 *   pnpm issue-design-variants
 *
 * Reads each `assets/issue-design/<folder>/renders.json` and writes, next to
 * every page, one copy per width in `PAGE_VARIANT_WIDTHS`
 * ("on-kapak.webp" → "on-kapak.w720.webp"). Run it after
 * `render-issue-design`; the import uploads whatever copies it finds. Nothing
 * here touches a database or a bucket.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderListSchema } from "@/lib/issue-design/manifest";
import { PAGE_VARIANT_WIDTHS, variantName } from "@/lib/issue-page-variants";

/** Lower than the original's 92: these are never zoomed, the original is. */
const QUALITY = 82;

const root = path.join(process.cwd(), "assets", "issue-design");

for (const folder of readdirSync(root)) {
  const dir = path.join(root, folder);
  if (!statSync(dir).isDirectory()) continue;
  const renders = renderListSchema.parse(JSON.parse(readFileSync(path.join(dir, "renders.json"), "utf8")));

  for (const record of renders) {
    const original = readFileSync(path.join(dir, record.file));
    for (const width of PAGE_VARIANT_WIDTHS) {
      const name = variantName(record.file, width);
      if (!name || width >= record.width) continue;
      const copy = await sharp(original)
        .resize({ width })
        .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
        .toBuffer();
      writeFileSync(path.join(dir, name), copy);
      console.log(`${folder}/${name} ${(copy.length / 1024).toFixed(0)} KB (from ${(original.length / 1024).toFixed(0)} KB)`);
    }
  }
}
