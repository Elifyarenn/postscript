/**
 * Server-side PNG of a team avatar (D-194, D-195).
 *
 * `next/og` already ships a renderer (resvg) with Next.js, so the PNG needs no
 * new dependency and is drawn on the server from the saved configuration: an
 * uploaded file could show anything, a configuration can only show the
 * catalogue. The avatar SVG has no background, so the PNG keeps its alpha.
 */
import "server-only";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { HAIR_IMAGE_DIR } from "./assets/hair-images";
import type { AvatarConfig } from "./registry";
import { renderAvatarSvg } from "./render";

/**
 * Picture files are inlined for the server renderer: it draws from a string
 * and cannot fetch a URL. Read once, kept for the life of the process.
 */
const inlined = new Map<string, string>();

function inlineHairImage(file: string): string {
  const cached = inlined.get(file);
  if (cached) return cached;
  // The name comes from the registry, never from a request; keep it that way
  const safe = path.basename(file);
  const bytes = readFileSync(path.join(process.cwd(), "public", HAIR_IMAGE_DIR, safe));
  const href = `data:image/png;base64,${bytes.toString("base64")}`;
  inlined.set(file, href);
  return href;
}

/** Square and large enough for print-size social media posts; ~1–2 s to draw. */
export const AVATAR_PNG_SIZE = 2048;

export async function renderAvatarPng(config: AvatarConfig, size = AVATAR_PNG_SIZE): Promise<Buffer> {
  const svg = renderAvatarSvg(config, { size, imageHref: inlineHairImage });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const response = new ImageResponse(createElement("img", { src, width: size, height: size }), {
    width: size,
    height: size,
  });
  return Buffer.from(await response.arrayBuffer());
}
