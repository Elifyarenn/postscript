/**
 * Türban (D-219).
 *
 * A headscarf is not hair, but it takes hair's place: it is chosen from the
 * hair list, so picking it means no hair style is chosen at all and nothing
 * shows underneath. It is drawn in head space like the face, not on the
 * finished canvas like the static hair, because it frames the face and must
 * follow it.
 *
 * The fabric has its own colour list. It borrows neither the hair colour (a
 * scarf is not hair) nor the clothing colour — the product owner asked for
 * headwear to stop taking the clothing colour.
 */
import { DETAIL, OUTLINE, cel, inHead, stroke, type DrawContext } from "../canvas";
import { smoothClosedPath, smoothOpenPath, symmetric, type Point } from "../geometry";
import type { Asset, ColorOption } from "./types";

export const SCARF_COLORS = [
  { id: "black", label: "Siyah", hex: "#26222a" },
  { id: "charcoal", label: "Antrasit", hex: "#45444a" },
  { id: "gray", label: "Gri", hex: "#8e8d93" },
  { id: "cream", label: "Krem", hex: "#efe3cf" },
  { id: "white", label: "Beyaz", hex: "#f2f0ec" },
  { id: "sand", label: "Bej", hex: "#d8c3a3" },
  { id: "camel", label: "Camel", hex: "#bf9563" },
  { id: "brown", label: "Kahve", hex: "#7a5741" },
  { id: "burgundy", label: "Bordo", hex: "#75263a" },
  { id: "rose", label: "Gül kurusu", hex: "#c08492" },
  { id: "powder", label: "Pudra", hex: "#e9c3c6" },
  { id: "plum", label: "Mürdüm", hex: "#5c3a63" },
  { id: "lilac", label: "Lila", hex: "#a08cc4" },
  { id: "navy", label: "Lacivert", hex: "#2f3f63" },
  { id: "blue", label: "Mavi", hex: "#5b7fb4" },
  { id: "teal", label: "Petrol", hex: "#3a7d80" },
  { id: "emerald", label: "Zümrüt", hex: "#3d7a5c" },
  { id: "olive", label: "Haki", hex: "#6f7346" },
  { id: "mustard", label: "Hardal", hex: "#c39a3c" },
] as const satisfies readonly ColorOption[];

/**
 * The fabric's outer edge, right half, crown to hem. It clears the ears —
 * which reach x 786 on the widest face — and comes to rest on the shoulder.
 */
const OUTER: Point[] = [
  [512, 188],
  [634, 200],
  [724, 254],
  [774, 350],
  [798, 476],
  [800, 576],
  [784, 666],
  [760, 744],
  [756, 802],
  [794, 852],
  [802, 906],
  [726, 930],
  [614, 922],
  [512, 916],
];

/**
 * The face opening, right half, forehead to under the chin. Every point stays
 * inside the narrowest face outline, so no background shows through the hole
 * whichever face shape is chosen; at the chin the edge passes just above the
 * tip, which is how a scarf sits under the jaw.
 */
const OPENING: Point[] = [
  [512, 322],
  [600, 332],
  [664, 386],
  [694, 468],
  [698, 552],
  [682, 630],
  [648, 692],
  [592, 736],
  [512, 758],
];

/**
 * The inner hem, a hand's width inside the opening: the edge of the cloth that
 * frames the face. It is what makes a scarf read as a scarf rather than a
 * hood, so it is a line of its own rather than a fold.
 */
const HEM: Point[] = [
  [512, 296],
  [606, 308],
  [678, 368],
  [712, 462],
  [718, 554],
  [702, 640],
  [664, 706],
  [602, 754],
  [512, 778],
];

/** One fold each side, where the cloth gathers over the temple. */
const FOLDS: Point[][] = [[[600, 216], [680, 262], [722, 344], [736, 432]]];

function draw(context: DrawContext): string {
  const outer = smoothClosedPath(symmetric(OUTER), 0.9);
  const opening = smoothClosedPath(symmetric(OPENING), 0.95);
  // One shape with a hole: the fabric is everything between the two outlines
  const fabric = `${outer} ${opening}`;
  const { scarf, scarfShade, scarfLine } = context.palette;

  const folds = FOLDS.flatMap((points) => [points, points.map(([x, y]) => [1024 - x, y] as Point)])
    .map((points) => stroke(smoothOpenPath(points), 3.5, scarfLine, ` opacity="0.6"`))
    .join("");

  return inHead(
    cel(context, "scarf", fabric, scarf, scarfShade, [-16, -10], false, true) +
      stroke(smoothClosedPath(symmetric(HEM), 0.95), DETAIL, scarfLine, ` opacity="0.8"`) +
      folds +
      stroke(outer, OUTLINE) +
      stroke(opening, OUTLINE),
  );
}

export const HEADSCARF: readonly Asset[] = [
  { id: "turban", label: "Türban", layers: { frontHair: draw } },
];

/** True for a head covering: the hair colour and texture mean nothing under it. */
export function isHeadscarf(styleId: string): boolean {
  return HEADSCARF.some((scarf) => scarf.id === styleId);
}

/** True when what is on the head hides the ears, so ear jewellery is not drawn. */
export function coversEars(context: DrawContext): boolean {
  return HEADSCARF.some((scarf) => context.selected.has(scarf.id));
}
