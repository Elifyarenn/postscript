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
import { ImageResponse } from "next/og";
import type { AvatarConfig } from "./registry";
import { renderAvatarSvg } from "./render";

/** Square and large enough for print-size social media posts; ~1–2 s to draw. */
export const AVATAR_PNG_SIZE = 2048;

export async function renderAvatarPng(config: AvatarConfig, size = AVATAR_PNG_SIZE): Promise<Buffer> {
  const svg = renderAvatarSvg(config, { size });
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const response = new ImageResponse(createElement("img", { src, width: size, height: size }), {
    width: size,
    height: size,
  });
  return Buffer.from(await response.arrayBuffer());
}
