/**
 * Eyes, eyebrows, nose and mouth (D-195), all in head space.
 *
 * The eyes carry the style: large but not chibi, a heavy upper lash line with
 * a small outer flick, a tall iris darker at the top, two highlights. The
 * nose and mouth stay small and simple, so the eyes lead.
 */
import { INK, fill, inHead, stroke, type DrawContext } from "../canvas";
import { shade } from "../geometry";
import type { Asset, ColorOption } from "./types";

/** Eye centres in head space; the left eye is the right one mirrored. */
export const EYE_Y = 560;
export const EYE_RIGHT_X = 624;
export const EYE_LEFT_X = 400;
/** Eyes are drawn a little larger than their outlines are written: the style's one exaggeration. */
export const EYE_SCALE = 1.14;

export const EYE_COLORS = [
  { id: "darkBrown", label: "Koyu kahve", hex: "#3a241b" },
  { id: "brown", label: "Kahverengi", hex: "#6a4028" },
  { id: "hazel", label: "Ela", hex: "#8b6a33" },
  { id: "amber", label: "Kehribar", hex: "#b57a2a" },
  { id: "green", label: "Yeşil", hex: "#4c7a4f" },
  { id: "blue", label: "Mavi", hex: "#4c7fb4" },
  { id: "gray", label: "Gri", hex: "#7c8993" },
  { id: "black", label: "Siyah", hex: "#1e1719" },
] as const satisfies readonly ColorOption[];

export const LIP_COLORS = [
  { id: "natural", label: "Doğal", hex: "" },
  { id: "rose", label: "Gül", hex: "#cf7784" },
  { id: "coral", label: "Mercan", hex: "#e0806f" },
  { id: "berry", label: "Vişne", hex: "#9c3047" },
  { id: "red", label: "Kırmızı", hex: "#c2323e" },
  { id: "plum", label: "Erik", hex: "#6c2945" },
  { id: "brown", label: "Kahve", hex: "#7a4a3c" },
] as const satisfies readonly ColorOption[];

type EyeShape = {
  /** Upper lid, from the inner corner (−x) to the outer corner (+x). */
  upper: string;
  /** The lower lid back to the inner corner, continuing `upper`. */
  lower: string;
  /** The outer corner, where the lash flick starts. */
  corner: readonly [number, number];
  crease?: string;
  /** A heavy lid lying over the top of the eye. */
  lid?: string;
  irisY?: number;
};

const EYE_SHAPES: Record<string, EyeShape> = {
  round: {
    upper: "M-52 8 C-46 -34 34 -42 56 -6",
    lower: "C46 32 -36 38 -52 8",
    corner: [56, -6],
    crease: "M-40 -40 C-12 -58 30 -56 52 -34",
  },
  almond: {
    upper: "M-58 10 C-42 -30 32 -38 62 -4",
    lower: "C42 24 -34 30 -58 10",
    corner: [62, -4],
    crease: "M-44 -36 C-14 -54 30 -52 56 -30",
  },
  droopy: {
    upper: "M-56 -4 C-38 -38 38 -36 62 12",
    lower: "C38 32 -36 28 -56 -4",
    corner: [62, 12],
    crease: "M-42 -44 C-10 -58 34 -50 58 -20",
  },
  cat: {
    upper: "M-58 16 C-42 -24 26 -42 64 -24",
    lower: "C46 14 -30 32 -58 16",
    corner: [64, -24],
    crease: "M-40 -30 C-10 -54 30 -60 58 -46",
  },
  monolid: {
    upper: "M-60 6 C-42 -22 34 -28 62 -6",
    lower: "C42 18 -38 22 -60 6",
    corner: [62, -6],
    irisY: 2,
  },
  sleepy: {
    upper: "M-58 10 C-42 -30 32 -38 62 -4",
    lower: "C42 24 -34 30 -58 10",
    corner: [62, -4],
    lid: "M-62 12 C-44 -36 34 -44 66 -4 C34 -10 -30 -12 -62 12Z",
  },
};

function eyePair(context: DrawContext, shapeId: string): string {
  const shape = EYE_SHAPES[shapeId] ?? EYE_SHAPES.almond!;
  const { palette } = context;
  const outline = `${shape.upper} ${shape.lower}Z`;
  const irisY = shape.irisY ?? 4;

  const eye = (cx: number, side: 1 | -1) => {
    const eyeClip = context.id(side === 1 ? "eye-r" : "eye-l");
    const irisClip = context.id(side === 1 ? "iris-r" : "iris-l");
    // Light from the upper left: both highlights sit on the same side on screen
    const hx = -12 * side;
    return (
      `<g transform="translate(${cx} ${EYE_Y}) scale(${side * EYE_SCALE} ${EYE_SCALE})">` +
      `<clipPath id="${eyeClip}"><path d="${outline}"/></clipPath>` +
      `<clipPath id="${irisClip}"><ellipse cx="2" cy="${irisY}" rx="31" ry="37"/></clipPath>` +
      fill(outline, "#fdf8f3") +
      `<g clip-path="url(#${eyeClip})">` +
      `<ellipse cx="2" cy="${irisY}" rx="31" ry="37" fill="${palette.eye}"/>` +
      `<g clip-path="url(#${irisClip})"><ellipse cx="2" cy="${irisY - 20}" rx="36" ry="30" fill="${shade(palette.eye, 0.45)}"/></g>` +
      `<ellipse cx="2" cy="${irisY}" rx="31" ry="37" fill="none" stroke="${shade(palette.eye, 0.6)}" stroke-width="3"/>` +
      `<ellipse cx="2" cy="${irisY + 3}" rx="12" ry="16" fill="#1a1315"/>` +
      // The lid's shadow across the top of the eye
      stroke(shape.upper, 16, palette.skinDeep, ` opacity="0.28" transform="translate(0 8)"`) +
      `<ellipse cx="${hx}" cy="${irisY - 13}" rx="9" ry="11" fill="#ffffff"/>` +
      `<circle cx="${-hx + 4 * side}" cy="${irisY + 17}" r="4" fill="#ffffff" opacity="0.9"/>` +
      "</g>" +
      (shape.lid ? fill(shape.lid, palette.skin) + stroke("M-60 10 C-30 -6 30 -10 64 -4", 5, palette.skinDeep) : "") +
      (shape.crease ? stroke(shape.crease, 3, palette.skinDeep, ` opacity="0.7"`) : "") +
      // The heavy upper lash line and its outer flick
      stroke(shape.upper, 10) +
      stroke(`M${shape.corner[0] - 4} ${shape.corner[1]} q14 -2 20 -14`, 6) +
      stroke(`M${shape.corner[0] - 6} ${shape.corner[1] + 2} ${shape.lower}`, 3, INK, ` opacity="0.55"`) +
      "</g>"
    );
  };
  return inHead(eye(EYE_RIGHT_X, 1) + eye(EYE_LEFT_X, -1));
}

function eyeShape(id: string, label: string): Asset {
  return { id, label, layers: { eyes: (context) => eyePair(context, id) } };
}

export const EYES = [
  eyeShape("almond", "Badem"),
  eyeShape("round", "Yuvarlak"),
  eyeShape("droopy", "Yumuşak bakış"),
  eyeShape("cat", "Kedi göz"),
  eyeShape("monolid", "Tek kapak"),
  eyeShape("sleepy", "Yarı kapalı"),
] as const satisfies readonly Asset[];

/** Extra lashes on the outer upper lid; neutral by default, for anyone who wants them. */
function lashes(count: number): Asset["layers"] {
  return {
    eyes: () => {
      const flicks = [
        "M44 -22 q10 -8 12 -20",
        "M30 -30 q6 -10 6 -22",
        "M54 -12 q12 -4 18 -14",
      ].slice(0, count);
      const pair = (cx: number, side: 1 | -1) =>
        `<g transform="translate(${cx} ${EYE_Y}) scale(${side * EYE_SCALE} ${EYE_SCALE})">${stroke(flicks.join(" "), 4)}</g>`;
      return inHead(pair(EYE_RIGHT_X, 1) + pair(EYE_LEFT_X, -1));
    },
  };
}

export const EYELASHES = [
  { id: "none", label: "Sade" },
  { id: "soft", label: "Hafif kirpik", layers: lashes(2) },
  { id: "full", label: "Belirgin kirpik", layers: lashes(3) },
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Eyebrows                                                            */
/* ------------------------------------------------------------------ */

const BROW_Y = 474;

function brow(id: string, label: string, d: string): Asset {
  return {
    id,
    label,
    layers: {
      eyebrows: (context) => {
        const pair = (cx: number, side: 1 | -1) =>
          `<g transform="translate(${cx} ${BROW_Y}) scale(${side} 1)">${fill(d, context.palette.brow)}</g>`;
        return inHead(pair(EYE_RIGHT_X, 1) + pair(EYE_LEFT_X, -1));
      },
    },
  };
}

// Right brow: −x is the inner end (towards the nose)
export const EYEBROWS = [
  brow("natural", "Doğal", "M-50 10 C-24 -8 22 -12 56 -2 C24 -4 -20 2 -48 19Z"),
  brow("straight", "Düz", "M-52 4 C-20 -4 24 -6 56 0 L56 7 C24 3 -20 6 -52 14Z"),
  brow("arched", "Kavisli", "M-50 14 C-30 -16 20 -24 56 4 C18 -12 -26 -6 -48 23Z"),
  brow("thick", "Kalın", "M-52 12 C-26 -14 22 -18 58 -4 L56 10 C22 4 -22 10 -50 28Z"),
  brow("worried", "Endişeli", "M-50 -8 C-24 -6 22 4 56 14 C22 10 -22 6 -48 4Z"),
  brow("determined", "Kararlı", "M-50 18 C-24 4 22 -10 56 -12 C22 -4 -22 12 -48 26Z"),
  brow("short", "Kısa", "M-30 4 C-10 -6 22 -6 36 0 C20 4 -10 6 -28 13Z"),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Nose                                                                */
/* ------------------------------------------------------------------ */

const NOSE_SHADOW = "M522 604 C530 624 536 640 522 650 C536 648 540 632 522 604Z";

function nose(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { nose: (context) => inHead(art(context)) } };
}

export const NOSES = [
  nose("small", "Küçük", (c) => fill(NOSE_SHADOW, c.palette.skinShade) + stroke("M518 616 C526 630 528 642 514 648", 4.5)),
  nose("line", "Çizgi", (c) => fill(NOSE_SHADOW, c.palette.skinShade) + stroke("M520 582 L528 638 C528 646 520 650 510 648", 4)),
  nose("button", "Yuvarlak", (c) => fill(NOSE_SHADOW, c.palette.skinShade) + stroke("M498 640 C504 650 522 650 528 640", 4.5)),
  nose("pointed", "Sivri", (c) => fill(NOSE_SHADOW, c.palette.skinShade) + stroke("M516 600 L536 642 L512 648", 4)),
  nose("dots", "Noktalı", () => `<circle cx="500" cy="642" r="3.4" fill="${INK}"/><circle cx="524" cy="642" r="3.4" fill="${INK}"/>`),
  nose("soft", "Gölgeli", (c) => fill("M520 596 C532 620 540 640 520 652 C512 654 500 650 498 644 C510 646 520 640 520 596Z", c.palette.skinShade)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Mouth                                                               */
/* ------------------------------------------------------------------ */

const INSIDE = "#5a2231";
const TONGUE = "#e0707f";

function mouth(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { mouth: (context) => inHead(art(context)) } };
}

/** A soft lower lip under line mouths, in the chosen lip colour. */
const lowerLip = (c: DrawContext) => `<ellipse cx="512" cy="714" rx="15" ry="4.5" fill="${c.palette.lip}" opacity="0.55"/>`;

export const MOUTHS = [
  mouth("smile", "Gülümseme", (c) => lowerLip(c) + stroke("M486 694 C500 708 524 708 538 692", 4.5)),
  mouth("neutral", "Nötr", (c) => lowerLip(c) + stroke("M492 702 C504 704 520 704 532 700", 4.5)),
  mouth("open", "Açık gülüş", () => {
    const d = "M482 690 C500 695 524 695 542 688 C538 724 488 726 482 690Z";
    return fill(d, INSIDE) + fill("M494 712 C504 704 520 704 530 712 C520 721 504 721 494 712Z", TONGUE) + stroke(d, 4);
  }),
  mouth("cat", "Kedi ağzı", () => stroke("M484 692 C490 706 504 706 512 696 C520 706 534 706 540 692", 4)),
  mouth("smirk", "Yarım gülüş", (c) => lowerLip(c) + stroke("M490 704 C508 708 526 700 540 686", 4.5) + stroke("M540 686 C546 684 548 690 545 694", 3)),
  mouth("pout", "Büzük", (c) => `<ellipse cx="512" cy="704" rx="10" ry="8" fill="${c.palette.lip}" stroke="${INK}" stroke-width="3.5"/>`),
  mouth("teeth", "Dişli gülüş", () => {
    const d = "M480 688 C500 693 524 693 544 686 C540 716 486 718 480 688Z";
    return fill(d, "#fffaf4") + stroke("M486 698 C504 702 522 702 538 696", 2.5, INK, ` opacity="0.35"`) + stroke(d, 4);
  }),
] as const satisfies readonly Asset[];

/** Piercings drawn on the face follow these anchor points; exported for `accessories.ts`. */
export const FACE_ANCHORS = {
  nostril: [540, 642] as const,
  septum: [512, 652] as const,
  lipCorner: [536, 714] as const,
  browEnd: [EYE_RIGHT_X + 50, BROW_Y - 8] as const,
};

