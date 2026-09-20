/**
 * The shared drawing frame of every avatar part (D-195).
 *
 * All parts draw on one 1024 × 1024 canvas. The head is drawn in its own
 * "head space" and scaled into place with `HEAD`, so the head proportion (about
 * 55–60 % of the picture) is one number here rather than something every
 * hair, eye and earring has to agree on. The body (neck, shoulders, clothes,
 * necklaces) is drawn straight in canvas space.
 */
import { luminance, mix, shade, tint, type Point } from "./geometry";

export const CANVAS = 1024;
export const CX = 512;

/** Warm dark line colour used for every outline. */
export const INK = "#2a1a1d";
export const OUTLINE = 6;
export const DETAIL = 4;

/** Head space → canvas: scale about the top centre and lift a little. */
export const HEAD_SCALE = 0.98;
export const HEAD_LIFT = -50;
export const HEAD = `translate(${CX} ${HEAD_LIFT}) scale(${HEAD_SCALE}) translate(${-CX} 0)`;

/** Where a head-space point lands on the canvas; used for thumbnail crops and tests. */
export function headToCanvas([x, y]: Point): Point {
  return [CX + (x - CX) * HEAD_SCALE, y * HEAD_SCALE + HEAD_LIFT];
}

/**
 * The drawing order. Neck comes before clothing (unlike a strict
 * body → clothing → neck order) so a collar or turtleneck can sit over it.
 */
export const LAYER_ORDER = [
  "backHair",
  "body",
  "neck",
  "clothing",
  "ears",
  "face",
  "skinDetails",
  "eyes",
  "eyebrows",
  "nose",
  "mouth",
  "facialHair",
  "frontHair",
  "glasses",
  "earrings",
  "piercings",
  "necklace",
  "accessories",
] as const;

export type LayerName = (typeof LAYER_ORDER)[number];

export type Palette = {
  skin: string;
  skinShade: string;
  skinDeep: string;
  hair: string;
  hairShade: string;
  hairDeep: string;
  hairStrand: string;
  brow: string;
  eye: string;
  lip: string;
  clothing: string;
  clothingShade: string;
  /** Hats keep a colour of their own, apart from the clothes (D-203). */
  headwear: string;
  glasses: string;
  metal: string;
};

export function buildPalette(colors: {
  skin: string;
  hair: string;
  eye: string;
  lip: string | null;
  clothing: string;
  headwear: string;
  glasses: string;
  metal: string;
}): Palette {
  const { skin, hair, clothing } = colors;
  const hairLight = luminance(hair);
  return {
    skin,
    skinShade: shade(skin, 0.18),
    skinDeep: shade(skin, 0.34),
    hair,
    hairShade: shade(hair, 0.3),
    hairDeep: shade(hair, 0.5),
    // Strands must read on black hair as well as on platinum
    hairStrand: hairLight < 0.06 ? tint(hair, 0.3) : shade(hair, 0.28),
    brow: hairLight > 0.35 ? shade(hair, 0.5) : shade(hair, 0.1),
    eye: colors.eye,
    lip: colors.lip ?? mix(shade(skin, 0.14), "#d0606f", 0.34),
    clothing,
    clothingShade: shade(clothing, luminance(clothing) < 0.05 ? 0.1 : 0.2),
    headwear: colors.headwear,
    glasses: colors.glasses,
    metal: colors.metal,
  };
}

/** What every draw function receives. */
export type DrawContext = {
  palette: Palette;
  /** The face outline (head space) and its right half, for shadows, beards and hair. */
  face: { path: string; right: readonly Point[] };
  /** How far the ears sit from the default face's ears (wider faces push them out). */
  earShift: number;
  /** The hair texture, which several parts (hair, beard, brows) follow. */
  texture: "straight" | "wavy" | "curly" | "coily";
  /** Ids of the other chosen parts a drawing may adapt to (a cap hides a bun, say). */
  selected: ReadonlySet<string>;
  /**
   * Where a picture file (a ready-made hair set) is loaded from: a URL in the
   * browser, an inline data URI on the server, where nothing can fetch (D-200).
   */
  imageHref: (file: string) => string;
  /** A clip-path or gradient id unique within the current layer. */
  id: (name: string) => string;
  /** Registers a `<defs>` entry for the current layer. */
  def: (markup: string) => void;
};

/* ------------------------------------------------------------------ */
/* Markup helpers                                                      */
/* ------------------------------------------------------------------ */

export function fill(d: string, color: string, extra = ""): string {
  return `<path d="${d}" fill="${color}"${extra}/>`;
}

export function stroke(d: string, width = OUTLINE, color = INK, extra = ""): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${extra}/>`;
}

export function inHead(markup: string): string {
  return markup ? `<g transform="${HEAD}">${markup}</g>` : "";
}

/**
 * A filled, outlined shape with one step of cel shade: the shade underneath,
 * the base colour on top nudged towards the light and clipped to the shape,
 * leaving a thin shadow on the far edges. The clip sits on a wrapper, because
 * on the moved path itself it would move along with it.
 */
export function cel(
  context: DrawContext,
  name: string,
  d: string,
  base: string,
  shadow: string,
  offset: Point = [-12, -8],
  outline = true,
): string {
  const id = context.id(name);
  context.def(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
  return (
    fill(d, shadow) +
    `<g clip-path="url(#${id})"><path d="${d}" fill="${base}" transform="translate(${-offset[0]} ${-offset[1]})"/></g>` +
    (outline ? stroke(d) : "")
  );
}

/** A metal ring or bar: an ink stroke under a thinner metal one. */
export function ring(d: string, metal: string, width = 5): string {
  return stroke(d, width + 3.5, INK) + stroke(d, width, metal);
}

export function bead(x: number, y: number, r: number, color: string): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  return (
    `<circle cx="${round(x)}" cy="${round(y)}" r="${r}" fill="${color}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="${round(x - r * 0.35)}" cy="${round(y - r * 0.35)}" r="${round(Math.max(1.2, r * 0.3))}" fill="#ffffff" opacity="0.85"/>`
  );
}

/** Deterministic pseudo random numbers, so freckles land on the same spots every time. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** A face outline's x at a given height (right side), read off its points. */
export function faceEdgeAt(right: readonly Point[], y: number): number | null {
  for (let index = 1; index < right.length; index += 1) {
    const [x0, y0] = right[index - 1]!;
    const [x1, y1] = right[index]!;
    if (y >= y0 && y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return null;
}
