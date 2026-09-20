/**
 * Hair as big, clean shapes (D-204).
 *
 * The first hair system (D-196…D-203) grew every style out of dozens of thin
 * locks. It could draw a lot, but each style ended up with its own logic and
 * the catalogue stopped looking like one illustrator's work. This file is the
 * replacement the product owner asked for: a Picrew-style asset set where a
 * style is nothing but geometry — three to eight closed shapes and at most six
 * detail lines — laid over the shared head anchors in `face.ts`.
 *
 * The rules, from the brief:
 *
 * - no hair strands, no anime spikes, no stray locks over the face, no
 *   gradients, no glossy highlights;
 * - the outline is the avatar's own line weight, detail lines are thinner;
 * - colour never sits in the geometry: the fill is the chosen hair colour, the
 *   few shadow shapes its shade, the detail lines the palette's line colour
 *   (what the brief calls `--hair-color`, `--hair-shadow`, `--hair-line`; the
 *   PNG is rasterised on the server, where CSS variables do not resolve, so
 *   the palette plays their part);
 * - near-symmetry, not mirror symmetry: a side runs a few pixels longer, a
 *   curve leans differently, the detail lines do not match.
 *
 * Layers follow the brief's order: `backHair` behind the head, `baseHair` over
 * the ears but *under* the face — so the forehead is always clean skin and the
 * hairline is drawn by the pieces on top — then `sideHair`, `bangs` and the
 * detail lines over the face.
 *
 * Every front piece reaches the skull's own edge (`SKULL_RIGHT`), so its
 * outline meets the base's exactly and the hair reads as one form rather than
 * a wig laid on a head.
 */
import { DETAIL, OUTLINE, fill, inHead, stroke, type DrawContext } from "../canvas";
import { mirrorX, smoothClosedPath, smoothOpenPath, symmetric, type Point } from "../geometry";
import { SKULL_RIGHT } from "./face";
import type { Asset } from "./types";

/** A closed piece of hair. The points are smoothed, so they read as a shape. */
type Shape = {
  points: Point[];
  /** Lower is tighter; 0.9 keeps a soft, drawn curve. */
  tension?: number;
  /** Filled with the hair's shadow and left unoutlined: a small darker area. */
  shadow?: boolean;
  /** Draws the same shape on the other side of the head as well. */
  mirror?: boolean;
};

type Line = { points: Point[]; mirror?: boolean };

export type ShapeHair = {
  id: string;
  label: string;
  /** Behind the head: the length of the hair. */
  back?: Shape[];
  /** Over the ears, under the face: the volume on the skull. */
  base?: Shape[];
  /** Over the face: what falls beside it. */
  side?: Shape[];
  /** Over the face: what covers the forehead, and with it the hairline. */
  bangs?: Shape[];
  /** At most six thin lines that show the direction the hair is combed. */
  details?: Line[];
};

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawShapes(shapes: Shape[] | undefined, context: DrawContext): string {
  if (!shapes?.length) return "";
  const { hair, hairShade } = context.palette;
  return shapes
    .map((shape) => {
      const sides = shape.mirror ? [shape.points, shape.points.map((point) => mirrorX(point))] : [shape.points];
      return sides
        .map((points) => {
          const d = smoothClosedPath(points, shape.tension ?? 0.9);
          return shape.shadow ? fill(d, hairShade) : fill(d, hair) + stroke(d, OUTLINE);
        })
        .join("");
    })
    .join("");
}

function drawLines(lines: Line[] | undefined, context: DrawContext): string {
  if (!lines?.length) return "";
  return lines
    .flatMap((line) => (line.mirror ? [line.points, line.points.map((point) => mirrorX(point))] : [line.points]))
    .map((points) => stroke(smoothOpenPath(points, 0.9), DETAIL - 0.5, context.palette.hairStrand, ` opacity="0.75"`))
    .join("");
}

/** Turns the geometry of one style into the layers the renderer stacks. */
export function shapeHairStyle(style: ShapeHair): Asset {
  return {
    id: style.id,
    label: style.label,
    layers: {
      backHair: (context) => inHead(drawShapes(style.back, context)),
      baseHair: (context) => inHead(drawShapes(style.base, context)),
      sideHair: (context) => inHead(drawShapes(style.side, context)),
      bangs: (context) => inHead(drawShapes(style.bangs, context)),
      hairDetails: (context) => inHead(drawLines(style.details, context)),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** The skull, closed under the face where nothing can see it. */
const cap = (bottom: Point[] = [[770, 520], [660, 552]]): Shape => ({
  points: symmetric([...SKULL_RIGHT, ...bottom]),
});

/** The skull read right to left, for a piece that crosses the whole head. */
const SKULL_LEFT: Point[] = [...SKULL_RIGHT].slice(1).reverse().map((p): Point => mirrorX(p));

/**
 * The hairline of a parted style, right half, read from the temple back up to
 * the parting. It leaves the parting almost level and only then turns down, so
 * the forehead opens as a notch; a straight run to the temple would draw a
 * sharp V and turn the forehead into a tent.
 */
const PARTED_HAIRLINE: Point[] = [[700, 500], [688, 438], [664, 380], [624, 334], [572, 304], [520, 286]];

/** The same for a fringe that crosses the whole forehead, right half. */
const FRINGE_LINE: Point[] = [[512, 392], [570, 396], [628, 414], [676, 446], [708, 486], [730, 528]];

/** The back of a long style; the front pieces are cut to end outside this. */
const LONG_BACK: Point[] = [[512, 180], [628, 196], [726, 252], [782, 350], [800, 470], [806, 650], [798, 846], [782, 978], [686, 1018], [578, 1030]];

/**
 * One side of the hair that frames the face: down the outside from the parting,
 * round the tip, then back up the inside — and that inside edge carries on into
 * the hairline. Front hair and fringe are one piece, so nothing shows where
 * they would otherwise meet.
 */
const frontPiece = (outer: Point[], inner: Point[], hairline = PARTED_HAIRLINE): Shape => ({
  points: [...SKULL_RIGHT, ...outer, ...inner, ...hairline],
});

/** A plain piece beside the face: outer edge down, inner edge back up. */
const sidePiece = (outer: Point[], inner: Point[]): Shape => ({ points: [...outer, ...inner] });

/** The mirror of a shape, for a side that should differ only a little. */
const mirrored = (shape: Shape): Shape => ({ ...shape, points: shape.points.map((point) => mirrorX(point)) });

/* ------------------------------------------------------------------ */
/* The styles                                                          */
/* ------------------------------------------------------------------ */

export const SHAPE_HAIR: ShapeHair[] = [
  {
    id: "straightCenter",
    label: "Düz — orta ayrım",
    back: [{ points: symmetric(LONG_BACK) }],
    base: [cap()],
    bangs: [
      frontPiece(
        [[790, 540], [806, 700], [800, 850], [780, 944], [752, 980]],
        [[720, 962], [712, 846], [702, 706], [696, 580]],
      ),
      // The left falls a little longer and hangs a little straighter
      mirrored(
        frontPiece(
          [[788, 548], [806, 712], [802, 868], [784, 964], [756, 1000]],
          [[722, 984], [714, 862], [704, 716], [698, 588]],
        ),
      ),
    ],
    details: [
      { points: [[576, 336], [634, 386], [676, 444]] },
      { points: [[438, 342], [388, 390], [352, 448]] },
      { points: [[762, 604], [772, 740], [764, 872]] },
      { points: [[258, 624], [250, 760], [258, 890]] },
    ],
  },
  {
    id: "sidePart",
    label: "Düz — yan ayrım",
    back: [{ points: symmetric([[512, 182], [624, 198], [720, 254], [776, 352], [792, 470], [796, 646], [786, 818], [768, 928], [668, 962], [568, 972]]) }],
    base: [cap()],
    // The heavy side crosses the forehead on the diagonal from a parting left
    // of centre; the light side turns back at the temple
    bangs: [
      {
        points: [
          [448, 196], [512, 184], [610, 192], [690, 228], [742, 292], [766, 368],
          [788, 560], [794, 716], [788, 840], [772, 920], [748, 950],
          [716, 930], [708, 820], [700, 688], [696, 560], [700, 484],
          [652, 424], [590, 364], [520, 300], [452, 224],
        ],
      },
      {
        points: [
          [448, 196], [414, 192], [334, 228], [282, 292], [258, 368],
          [236, 566], [230, 722], [238, 842], [254, 918], [280, 948],
          [308, 926], [316, 818], [324, 688], [330, 560], [326, 470],
          [306, 406], [330, 336], [374, 272], [422, 234],
        ],
      },
    ],
    details: [
      { points: [[492, 260], [572, 330], [646, 396]] },
      { points: [[440, 268], [394, 322], [364, 388]] },
      { points: [[762, 596], [770, 722], [762, 836]] },
      { points: [[262, 620], [256, 740], [264, 844]] },
    ],
  },
  {
    id: "shortStraight",
    label: "Kısa düz",
    back: [{ points: symmetric([[512, 182], [624, 196], [718, 250], [772, 344], [790, 462], [786, 596], [764, 692], [722, 748], [618, 738], [512, 732]]) }],
    base: [cap()],
    // One piece across the whole forehead, sitting a little lower on the left,
    // carried down past the ears to the jaw
    bangs: [
      {
        points: [
          [252, 452], ...SKULL_LEFT, [512, 184], ...SKULL_RIGHT.slice(1),
          [792, 576], [788, 672], [762, 730],
          [720, 714], [708, 612], [700, 512],
          ...[...FRINGE_LINE].reverse().slice(1),
          [452, 400], [396, 422], [340, 456],
          [320, 520], [316, 620], [304, 728],
          [258, 746], [232, 686], [230, 580], [252, 452],
        ],
      },
    ],
    details: [
      { points: [[570, 420], [636, 438], [690, 474]] },
      { points: [[454, 422], [392, 448], [344, 488]] },
      { points: [[758, 566], [764, 650], [750, 712]] },
    ],
  },
  {
    id: "curtain",
    label: "Perdeli",
    back: [{ points: symmetric([[512, 180], [630, 196], [728, 252], [784, 350], [802, 472], [806, 652], [794, 806], [774, 890], [664, 912], [560, 918]]) }],
    base: [cap()],
    // The hair that hangs beside the face, behind the curtain
    side: [
      sidePiece([[772, 470], [800, 612], [808, 754], [796, 866], [768, 906]], [[734, 884], [722, 756], [710, 618], [704, 496]]),
      sidePiece([[252, 476], [224, 622], [216, 766], [228, 876], [256, 918]], [[290, 896], [302, 764], [314, 622], [320, 502]]),
    ],
    // The curtain itself: from the parting, out over the temple and back in to
    // a point on the cheekbone, clear of the eyes
    bangs: [
      {
        mirror: true,
        // The lower edge runs on the diagonal, from the temple in to a point on
        // the cheekbone: that slant is what makes a curtain read as a curtain
        points: [
          ...SKULL_RIGHT, [768, 520], [742, 584], [706, 630],
          [678, 566], [658, 492], [634, 418], [602, 356], [558, 308], [524, 284],
        ],
      },
    ],
    details: [
      { points: [[566, 330], [620, 400], [664, 486]] },
      { points: [[456, 336], [402, 408], [364, 494]] },
      { points: [[766, 626], [774, 752], [762, 860]] },
      { points: [[258, 642], [252, 764], [264, 872]] },
    ],
  },
  {
    id: "wolf",
    label: "Katlı",
    back: [{ points: symmetric([[512, 172], [634, 190], [734, 248], [790, 348], [808, 478], [812, 652], [800, 812], [780, 908], [666, 934], [560, 940]]) }],
    base: [{ points: symmetric([[512, 172], [616, 182], [700, 222], [750, 290], [772, 372], [776, 456], [772, 524], [660, 556]]) }],
    // The long layer hangs to the chest; the short one steps over it at the
    // cheek, and that step is the whole point of the cut
    side: [
      sidePiece([[802, 560], [820, 706], [814, 846], [794, 922], [762, 946]], [[738, 914], [728, 800], [720, 676], [718, 566]]),
      sidePiece([[222, 572], [204, 720], [210, 858], [230, 934], [262, 960]], [[288, 926], [298, 812], [306, 688], [306, 578]]),
    ],
    bangs: [
      {
        points: [
          [252, 452], [256, 362], [284, 284], [338, 218], [418, 182], [512, 172], [616, 182], [700, 222], [750, 290], [772, 372],
          [814, 500], [790, 596], [744, 626],
          [716, 556], [706, 456], [650, 412], [572, 390], [492, 392], [420, 416], [352, 452],
          [306, 470], [286, 570], [262, 636],
          [222, 604], [214, 506], [252, 452],
        ],
      },
    ],
    details: [
      { points: [[570, 414], [634, 434], [688, 472]] },
      { points: [[452, 418], [388, 446], [340, 490]] },
      { points: [[776, 660], [788, 776], [780, 886]] },
      { points: [[248, 676], [240, 792], [248, 900]] },
    ],
  },
  {
    id: "pixie",
    label: "Pixie",
    // Only a short piece at the nape, behind the ears
    back: [{ mirror: true, points: [[746, 402], [778, 486], [772, 568], [740, 604], [716, 528], [712, 440]] }],
    base: [{ points: symmetric([[512, 182], [616, 190], [696, 226], [748, 292], [768, 372], [762, 446], [736, 492], [660, 510], [560, 506]]) }],
    // Swept across the forehead and carried down into a short point in front of
    // each ear, so the point belongs to the fringe instead of being a tab
    bangs: [
      {
        points: [
          [292, 500], [262, 438], [256, 360], [284, 284], [336, 220], [416, 186], [512, 182], [616, 190], [696, 226], [748, 292], [768, 372],
          [762, 452], [748, 512], [730, 524], [714, 476], [674, 432], [620, 404], [556, 390], [488, 392], [424, 412], [366, 444], [322, 478],
        ],
      },
    ],
    details: [
      { points: [[562, 400], [632, 422], [684, 458]] },
      { points: [[452, 408], [390, 438], [340, 478]] },
      { points: [[724, 288], [668, 250], [598, 232]] },
    ],
  },
];


/** True for a style drawn as shapes (D-204); those carry their own texture. */
export function isShapeHair(styleId: string): boolean {
  return SHAPE_HAIR.some((style) => style.id === styleId);
}
