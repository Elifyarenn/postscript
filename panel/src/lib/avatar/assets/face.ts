/**
 * Face shapes and skin tones (D-195). Every face shape draws the same base:
 * shoulders, neck, ears and the face itself; only the outline differs. The
 * faces are soft and slightly stylised (a gentle V or rounded jaw, full
 * cheeks), not the long realistic proportions of the first version.
 */
import { CX, DETAIL, OUTLINE, cel, fill, inHead, stroke, type DrawContext } from "../canvas";
import { mirrorX, smoothClosedPath, symmetric, type Point } from "../geometry";
import type { Asset, ColorOption } from "./types";

export const SKIN_TONES = [
  { id: "tone1", label: "Ten tonu 1", hex: "#fbe4d6" },
  { id: "tone2", label: "Ten tonu 2", hex: "#f4d1ba" },
  { id: "tone3", label: "Ten tonu 3", hex: "#ecbf9c" },
  { id: "tone4", label: "Ten tonu 4", hex: "#dca77f" },
  { id: "tone5", label: "Ten tonu 5", hex: "#c98f64" },
  { id: "tone6", label: "Ten tonu 6", hex: "#ab744d" },
  { id: "tone7", label: "Ten tonu 7", hex: "#8e5c3c" },
  { id: "tone8", label: "Ten tonu 8", hex: "#70452c" },
  { id: "tone9", label: "Ten tonu 9", hex: "#573421" },
  { id: "tone10", label: "Ten tonu 10", hex: "#402619" },
] as const satisfies readonly ColorOption[];

/** Right half of each face in head space, forehead top to chin. */
export const FACE_OUTLINES: Record<string, Point[]> = {
  vShape: [[512, 262], [606, 270], [682, 316], [722, 398], [732, 484], [724, 566], [696, 642], [644, 708], [578, 756], [512, 774]],
  round: [[512, 262], [610, 270], [690, 320], [732, 404], [742, 492], [734, 584], [702, 662], [642, 722], [574, 758], [512, 768]],
  oval: [[512, 256], [600, 264], [674, 312], [712, 396], [720, 486], [712, 574], [682, 654], [630, 718], [570, 762], [512, 780]],
  softSquare: [[512, 262], [610, 268], [690, 314], [730, 398], [738, 490], [734, 584], [716, 656], [668, 714], [592, 754], [512, 766]],
  heart: [[512, 256], [614, 264], [698, 314], [740, 400], [742, 478], [722, 562], [684, 638], [624, 708], [562, 760], [512, 784]],
};

/** The default face's widest point; ears move out by however much wider a face is. */
export const EAR_BASE_X = 732;

/**
 * The named points of the head, in head space (D-204). Hair is built on these
 * rather than on numbers copied into each style, so every hair style sits on
 * the same skull and changing the hair never moves the face.
 *
 * `headTop` is the top of the *hair*, a little above the face outline, because
 * hair has volume; the face's own top is `FACE_OUTLINES[...][0]`.
 */
export const HEAD_ANCHORS = {
  headTop: [512, 184],
  foreheadCenter: [512, 330],
  leftTemple: [342, 316],
  rightTemple: [682, 316],
  leftEarTop: [276, 506],
  rightEarTop: [748, 506],
  leftJawArea: [328, 642],
  rightJawArea: [696, 642],
  neckCenter: [512, 774],
} as const satisfies Record<string, Point>;

/**
 * The skull's right half, from the top centre down to below the temple: the
 * outer edge every hair style shares, so the silhouettes agree (D-204).
 */
export const SKULL_RIGHT: Point[] = [
  HEAD_ANCHORS.headTop,
  [610, 192],
  [690, 228],
  [742, 292],
  [766, 368],
  // Just below the temple, where the hair starts falling beside the face
  [772, 452],
];

const SHOULDERS_RIGHT: Point[] = [[606, 752], [722, 772], [834, 812], [912, 880], [950, 1060]];

/** Shoulders with a given neckline (canvas space), listed left to right across the neck. */
export function torso(neckline: readonly Point[]): string {
  const left = SHOULDERS_RIGHT.map((point) => mirrorX(point)).reverse();
  return smoothClosedPath([...left, ...neckline, ...SHOULDERS_RIGHT, [CX, 1110]], 0.7);
}

export const NECK = "M478 620 L546 620 C546 690 552 726 572 762 L452 762 C472 726 478 690 478 620Z";

const EAR_RIGHT: Point[] = [[716, 526], [748, 506], [776, 532], [776, 590], [754, 632], [724, 642]];

/** The ear lobe and the top of the rim, in head space, for earrings and piercings. */
export function earPoints(context: DrawContext) {
  return {
    lobe: [754 + context.earShift, 636] as Point,
    rim: [778 + context.earShift, 548] as Point,
  };
}

const base = {
  body: (context: DrawContext) => {
    const { skin, skinShade } = context.palette;
    return cel(context, "torso", torso([[440, 760], [512, 748], [584, 760]]), skin, skinShade, [-14, 6]);
  },
  neck: (context: DrawContext) => {
    const { skin, skinDeep } = context.palette;
    const id = context.id("neck");
    context.def(`<clipPath id="${id}"><path d="${NECK}"/></clipPath>`);
    return (
      fill(NECK, context.palette.skinShade) +
      `<g clip-path="url(#${id})">` +
      fill(NECK, skin, ` transform="translate(8 0)"`) +
      // The jaw casts its own outline down onto the neck
      inHead(fill(context.face.path, skinDeep, ` transform="translate(0 40)" opacity="0.55"`)) +
      "</g>" +
      stroke("M478 628 C478 690 472 726 452 762") +
      stroke("M546 628 C546 690 552 726 572 762")
    );
  },
  ears: (context: DrawContext) => {
    const { skin, skinShade } = context.palette;
    const right = EAR_RIGHT.map(([x, y]) => [x + context.earShift, y] as Point);
    const ear = (points: Point[], side: 1 | -1) => {
      const d = smoothClosedPath(points);
      const x = (value: number) => (side === 1 ? value + context.earShift : CX * 2 - value - context.earShift);
      return (
        fill(d, skin) +
        stroke(d, OUTLINE) +
        stroke(`M${x(742)} 548 C${x(762)} 560 ${x(760)} 592 ${x(742)} 606`, DETAIL, skinShade)
      );
    };
    return inHead(ear(right, 1) + ear(right.map((point) => mirrorX(point)), -1));
  },
  face: (context: DrawContext) => {
    const { skin, skinShade } = context.palette;
    return inHead(cel(context, "face", context.face.path, skin, skinShade, [-12, -4]));
  },
};

function faceShape(id: string, label: string): Asset {
  return { id, label, layers: base };
}

export const FACES = [
  faceShape("vShape", "Yumuşak V"),
  faceShape("round", "Yuvarlak"),
  faceShape("oval", "Oval"),
  faceShape("softSquare", "Yumuşak kare"),
  faceShape("heart", "Kalp"),
] as const satisfies readonly Asset[];

export function facePathFor(faceId: string): { path: string; right: Point[] } {
  const right = FACE_OUTLINES[faceId] ?? FACE_OUTLINES.vShape!;
  return { path: smoothClosedPath(symmetric(right)), right };
}

