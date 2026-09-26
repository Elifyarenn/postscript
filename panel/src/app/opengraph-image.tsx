/**
 * The image WhatsApp, X, LinkedIn and Discord show for a shared link (D-252).
 *
 * Nothing in it depends on the request, so Next draws it once at build time;
 * the files it reads are only needed during `next build`.
 */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SHARE_IMAGE } from "@/lib/seo";

export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = "image/png";

// Colours from site.css (--site-paper, --site-ink, --site-muted)
const PAPER = "#ded2c7";
const INK = "#420a14";
const MUTED = "#75625e";

export default async function OpengraphImage() {
  const [wordmark, font] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/design/wordmark.png"), "base64"),
    // A known font for â, ı, ğ and ş; DejaVu is already shipped for the PDFs
    readFile(join(process.cwd(), "assets/fonts/DejaVuSans.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
          color: INK,
          fontFamily: "DejaVu",
        }}
      >
        {/* 1429 x 180 source, scaled to the image's width with a margin */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain img only */}
        <img src={`data:image/png;base64,${wordmark}`} width={960} height={121} alt="" />
        <div style={{ marginTop: 48, fontSize: 44 }}>The things left unsaid</div>
        <div style={{ marginTop: 28, fontSize: 30, color: MUTED }}>
          Kâr amacı gütmeyen Türkçe e-dergi · postscriptmag.com
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "DejaVu", data: font, style: "normal", weight: 400 }] },
  );
}
