/**
 * Draws a temporary preview page to PNG on the server (D-247).
 *
 * `next/og` already ships with Next.js and is used for the team avatars
 * (D-194), so this needs no new dependency. It cannot fetch a URL or read a
 * variable font: the photographs are inlined as data URIs and the three faces
 * of the site are bundled as static TTFs (SIL OFL, licences beside them).
 */
import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { FONT, PAGE_HEIGHT, PAGE_WIDTH } from "./pages";
import { STOCK, type StockKey } from "./stock";

const ASSETS = path.join(process.cwd(), "assets", "issue-preview");

type FontEntry = { name: string; data: Buffer; weight: 300 | 400 | 600; style: "normal" | "italic" };

let fonts: FontEntry[] | null = null;

function loadFonts(): FontEntry[] {
  if (fonts) return fonts;
  const read = (file: string) => readFileSync(path.join(ASSETS, "fonts", file));
  fonts = [
    { name: FONT.caps, data: read("BodoniModa-Regular.ttf"), weight: 400, style: "normal" },
    { name: FONT.caps, data: read("BodoniModa-SemiBold.ttf"), weight: 600, style: "normal" },
    { name: FONT.italic, data: read("CormorantGaramond-LightItalic.ttf"), weight: 300, style: "italic" },
    { name: FONT.italic, data: read("CormorantGaramond-Italic.ttf"), weight: 400, style: "italic" },
    { name: FONT.body, data: read("SourceSerif4-Regular.ttf"), weight: 400, style: "normal" },
    { name: FONT.body, data: read("SourceSerif4-SemiBold.ttf"), weight: 600, style: "normal" },
    { name: FONT.body, data: read("SourceSerif4-Italic.ttf"), weight: 400, style: "italic" },
  ];
  return fonts;
}

const inlined = new Map<StockKey, string>();

/** A stock photo as a data URI; the key comes from the manifest, never a request. */
export function stockDataUri(key: StockKey): string {
  const cached = inlined.get(key);
  if (cached) return cached;
  const bytes = readFileSync(path.join(ASSETS, "stock", path.basename(STOCK[key].file)));
  const uri = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  inlined.set(key, uri);
  return uri;
}

export async function renderPagePng(element: ReactElement): Promise<Buffer> {
  const response = new ImageResponse(element, {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    fonts: loadFonts(),
  });
  return Buffer.from(await response.arrayBuffer());
}
