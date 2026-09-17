/**
 * Face details (D-195): freckles, moles, blush, under-eye marks, scars and
 * facial hair. Head space; the beard is built from the chosen face outline,
 * so it fits a V-shaped jaw as well as a round one.
 */
import { CX, INK, OUTLINE, fill, inHead, seeded, stroke, type DrawContext } from "../canvas";
import { luminance, mirrorX, mix, shade, smoothClosedPath, symmetric, texturedClosedPath, tint, type Point, type ShapePoint } from "../geometry";
import { EYE_LEFT_X, EYE_RIGHT_X, EYE_SCALE, EYE_Y } from "./features";
import { NONE, type Asset } from "./types";

function skinDetail(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { skinDetails: (context) => inHead(art(context)) } };
}

/* ------------------------------------------------------------------ */
/* Freckles                                                            */
/* ------------------------------------------------------------------ */

function freckles(count: number) {
  return (context: DrawContext) => {
    const random = seeded(11);
    const { skin } = context.palette;
    const color = luminance(skin) > 0.15 ? shade(skin, 0.42) : tint(skin, 0.24);
    let art = "";
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1;
      const dx = 26 + random() * 118;
      const x = CX + side * dx;
      const y = 600 + random() * 58 - dx * 0.1;
      art += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.6 + random() * 1.8).toFixed(1)}" fill="${color}" opacity="0.8"/>`;
    }
    return art;
  };
}

export const FRECKLES = [
  NONE,
  skinDetail("light", "Az", freckles(16)),
  skinDetail("dense", "Yoğun", freckles(34)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Moles                                                               */
/* ------------------------------------------------------------------ */

function mole(id: string, label: string, [x, y]: Point): Asset {
  return skinDetail(id, label, (c) => `<circle cx="${x}" cy="${y}" r="5" fill="${mix(c.palette.skin, "#1f1210", 0.72)}"/>`);
}

export const MOLES = [
  NONE,
  mole("eyeCorner", "Göz kenarında", [694, 604]),
  mole("cheek", "Yanakta", [664, 668]),
  mole("lip", "Dudak üstünde", [550, 686]),
  mole("chin", "Çenede", [486, 748]),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Blush                                                               */
/* ------------------------------------------------------------------ */

function blush(opacity: number, lines: boolean) {
  return (context: DrawContext) => {
    const color = luminance(context.palette.skin) > 0.12 ? "#f0848f" : "#d96a78";
    const cheek = (x: number) =>
      `<ellipse cx="${x}" cy="636" rx="48" ry="22" fill="${color}" opacity="${opacity}"/>` +
      (lines ? stroke(`M${x - 22} 642 l10 -14 M${x - 4} 642 l10 -14 M${x + 14} 642 l10 -14`, 3, "#d0566a", ` opacity="0.55"`) : "");
    return cheek(EYE_RIGHT_X + 18) + cheek(EYE_LEFT_X - 18);
  };
}

export const BLUSH = [
  NONE,
  skinDetail("soft", "Hafif", blush(0.22, false)),
  skinDetail("rosy", "Belirgin", blush(0.36, false)),
  skinDetail("lines", "Çizgili", blush(0.3, true)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Under the eyes                                                      */
/* ------------------------------------------------------------------ */

function underEye(art: (context: DrawContext, cx: number, side: 1 | -1) => string) {
  return (context: DrawContext) => {
    const pair = (cx: number, side: 1 | -1) =>
      `<g transform="translate(${cx} ${EYE_Y}) scale(${side * EYE_SCALE} ${EYE_SCALE})">${art(context, cx, side)}</g>`;
    return pair(EYE_RIGHT_X, 1) + pair(EYE_LEFT_X, -1);
  };
}

export const UNDER_EYE = [
  NONE,
  skinDetail("lines", "İnce çizgi", underEye((c) => stroke("M-30 40 C-6 50 24 48 44 34", 3, c.palette.skinDeep, ` opacity="0.6"`))),
  skinDetail("bags", "Torbalı", underEye((c) => stroke("M-36 38 C-8 52 26 50 48 32 M-24 52 C-2 60 22 58 38 48", 3, c.palette.skinDeep, ` opacity="0.55"`))),
  skinDetail("tired", "Yorgun", underEye((c) => `<ellipse cx="4" cy="42" rx="46" ry="14" fill="${c.palette.skinDeep}" opacity="0.22"/>`)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Scars                                                               */
/* ------------------------------------------------------------------ */

export const SCARS = [
  NONE,
  skinDetail("brow", "Kaşta çizik", (c) =>
    // A clean gap through the brow, the classic slit
    `<path d="M658 452 L672 448 L684 494 L670 498Z" fill="${c.palette.skin}"/>` + stroke("M664 440 L680 504", 2.5, c.palette.skinDeep),
  ),
  skinDetail("cheek", "Yanakta iz", (c) =>
    stroke("M640 650 L700 616", 3.5, mix(c.palette.skin, "#b0586a", 0.45)) +
    stroke("M656 632 l10 14 M672 624 l10 14 M688 614 l8 12", 2.5, mix(c.palette.skin, "#b0586a", 0.45)),
  ),
  skinDetail("nose", "Burunda iz", (c) => stroke("M488 612 L540 604", 3.5, mix(c.palette.skin, "#b0586a", 0.4))),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Facial hair                                                         */
/* ------------------------------------------------------------------ */

/** The beard band around the jaw, from the face outline, with a smooth edge under the mouth. */
function beardBand(context: DrawContext, full: boolean): ShapePoint[] {
  const startY = full ? 560 : 606;
  const push = full ? 12 : 5;
  const right = context.face.right
    .filter(([, y]) => y >= startY)
    .map(([x, y]) => {
      const drop = full && y > 700 ? ((y - 700) / 80) * 44 : 0;
      return [x + (x > CX ? push : 0), y + drop + (x === CX ? push : 0)] as Point;
    });
  const outer = [...right.slice(0, -1), ...right.slice().reverse().map((point) => mirrorX(point))];
  const top = right[0]!;
  const inner: Point[] = [[CX * 2 - top[0] + 30, startY + 18], [454, 690], [478, 736], [512, 742], [546, 736], [570, 690], [top[0] - 30, startY + 18]];
  return [...outer.map((p) => [p[0], p[1], true] as const), ...inner.map((p) => [p[0], p[1], false] as const)];
}

const MUSTACHE = smoothClosedPath(symmetric([[512, 670], [542, 664], [572, 680], [580, 700], [548, 692], [512, 690]]), 0.8);

function facial(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { facialHair: (context) => inHead(art(context)) } };
}

const solid = (c: DrawContext, d: string) => fill(d, c.palette.hair) + stroke(d, OUTLINE, INK);
const band = (c: DrawContext, full: boolean) => texturedClosedPath(beardBand(c, full), c.texture, 0.5);

export const FACIAL_HAIR = [
  NONE,
  facial("stubble", "Hafif sakal", (c) => fill(band(c, false), c.palette.hair, ` opacity="0.18"`) + fill(MUSTACHE, c.palette.hair, ` opacity="0.18"`)),
  facial("mustache", "Bıyık", (c) => solid(c, MUSTACHE)),
  facial("goatee", "Keçi sakal", (c) => solid(c, smoothClosedPath(symmetric([[512, 728], [536, 732], [548, 752], [536, 780], [512, 792]]), 0.9)) + solid(c, MUSTACHE)),
  facial("shortBeard", "Kısa sakal", (c) => solid(c, band(c, false)) + solid(c, MUSTACHE)),
  facial("fullBeard", "Gür sakal", (c) => solid(c, band(c, true)) + solid(c, MUSTACHE)),
] as const satisfies readonly Asset[];
