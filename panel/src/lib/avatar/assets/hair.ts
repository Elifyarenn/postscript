/**
 * Hair (D-195, reworked in D-196): styles, textures and colours, head space.
 *
 * Hair is built from many thin locks rather than a few wide wedges, which is
 * what the reference drawing does: a soft base underneath, a canopy of locks
 * fanning from the crown that forms the silhouette with pointed tips, a fringe
 * of separate strands over the forehead with gaps between them, and side locks
 * that fall past the ears. Stray tufts break the outline, so it never reads as
 * a helmet.
 *
 * Locks come from `fan(...)`: roots spread along one line, tips along another,
 * with a fixed amount of variation per lock, so a whole style is a handful of
 * numbers instead of hundreds. The texture (straight, wavy, curly, coily)
 * bends every lock and scallops the base.
 *
 * Side locks follow the texture: straight hair falls in front of the ears, as
 * the product owner asked; wavy and curly hair stays tucked behind them, the
 * way the reference shows it with the ear piercings on view.
 */
import { INK, OUTLINE, cel, fill, inHead, seeded, stroke, type DrawContext } from "../canvas";
import {
  lockCurl,
  lockPath,
  lockStrand,
  mirrorLock,
  mirrorX,
  mix,
  symmetric,
  texturedClosedPath,
  tint,
  type Lock,
  type Point,
  type ShapePoint,
} from "../geometry";
import type { Asset, ColorOption } from "./types";

export const HAIR_COLORS = [
  { id: "black", label: "Siyah", hex: "#241c1e" },
  { id: "darkBrown", label: "Koyu kahve", hex: "#3e2a22" },
  { id: "brown", label: "Kahverengi", hex: "#6b4631" },
  { id: "auburn", label: "Kestane", hex: "#8e3a2a" },
  { id: "red", label: "Kızıl", hex: "#b4473b" },
  { id: "copper", label: "Bakır", hex: "#c46a35" },
  { id: "darkBlonde", label: "Koyu sarı", hex: "#b88c55" },
  { id: "blonde", label: "Sarı", hex: "#e3c283" },
  { id: "platinum", label: "Platin", hex: "#efe2c6" },
  { id: "ash", label: "Küllü", hex: "#b8b2ad" },
  { id: "gray", label: "Kır", hex: "#8f8c8a" },
  { id: "white", label: "Beyaz", hex: "#ebe8e2" },
  { id: "burgundy", label: "Bordo", hex: "#6f1d2c" },
  { id: "pink", label: "Pembe", hex: "#e39bb4" },
  { id: "lilac", label: "Mor", hex: "#8d74c0" },
  { id: "blue", label: "Mavi", hex: "#4f7cc6" },
  { id: "teal", label: "Petrol", hex: "#3f8f94" },
  { id: "green", label: "Yeşil", hex: "#4f9a78" },
] as const satisfies readonly ColorOption[];

export const HAIR_TEXTURES = [
  { id: "straight", label: "Düz" },
  { id: "wavy", label: "Dalgalı" },
  { id: "curly", label: "Kıvırcık" },
  { id: "coily", label: "Sık kıvırcık" },
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Lock fans                                                           */
/* ------------------------------------------------------------------ */

type Fan = {
  /** Roots spread evenly between these two points. */
  root: [Point, Point];
  /** Tips spread evenly between these two points. */
  tip: [Point, Point];
  count: number;
  /** Lock width at the first root → at the last. */
  width: [number, number];
  /** How far the middle of the first → last lock bows sideways. */
  bend: [number, number];
  /** How far the first → last lock curls at its tip; see `Lock`. */
  hook?: [number, number];
  /** How much a tip may fall short or overshoot, in canvas units. */
  vary?: number;
  /** Also draws the fan mirrored to the other side of the face. */
  mirror?: boolean;
};

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * Turns a fan into locks. The variation is deterministic, so a style always
 * draws the same hair.
 */
function fan(spec: Fan, seed: number): Lock[] {
  const random = seeded(seed);
  const locks: Lock[] = [];
  for (let index = 0; index < spec.count; index += 1) {
    const t = spec.count === 1 ? 0 : index / (spec.count - 1);
    const drift = spec.vary ? (random() - 0.5) * 2 * spec.vary : 0;
    locks.push([
      lerp(spec.root[0][0], spec.root[1][0], t),
      lerp(spec.root[0][1], spec.root[1][1], t),
      lerp(spec.tip[0][0], spec.tip[1][0], t) + drift * 0.35,
      lerp(spec.tip[0][1], spec.tip[1][1], t) + drift,
      lerp(spec.width[0], spec.width[1], t) * (0.85 + random() * 0.3),
      lerp(spec.bend[0], spec.bend[1], t),
      spec.hook ? lerp(spec.hook[0], spec.hook[1], t) * (0.8 + random() * 0.4) : 0,
    ]);
  }
  return spec.mirror ? [...locks, ...locks.map((lock) => mirrorLock(lock))] : locks;
}

const fans = (...specs: Fan[]): Lock[] => specs.flatMap((spec, index) => fan(spec, 17 + index * 131));

/* ------------------------------------------------------------------ */
/* Bases                                                               */
/* ------------------------------------------------------------------ */

/** Mirrors a right half into an outline running left bottom → top → right bottom. */
function arch(right: readonly Point[]): Point[] {
  return [...right.slice(1).map((point) => mirrorX(point)).reverse(), ...right];
}

/**
 * The soft shape under the locks. It sits a little inside them, so the
 * silhouette is made of lock tips rather than of this outline.
 */
function cap(outerRight: readonly Point[], hairline: readonly Point[]): ShapePoint[] {
  const outer = arch(outerRight);
  return [
    ...outer.slice(0, -1).map((p) => [p[0], p[1], true] as const),
    [outer[outer.length - 1]![0], outer[outer.length - 1]![1], false] as const,
    ...hairline.map((p) => [p[0], p[1], false] as const),
  ];
}

const CAP = cap(
  [[512, 186], [628, 200], [716, 256], [762, 350], [772, 436], [756, 482]],
  [[712, 476], [702, 404], [672, 334], [602, 292], [512, 282], [422, 292], [352, 334], [322, 404], [312, 476]],
);

const BUZZ_CAP = cap(
  [[512, 214], [622, 226], [706, 280], [746, 370], [752, 470], [744, 516]],
  [[712, 518], [704, 430], [670, 340], [600, 304], [512, 296], [424, 304], [354, 340], [320, 430], [312, 518]],
);

function ellipse(cx: number, cy: number, rx: number, ry: number, count: number, maxY = Infinity): ShapePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * rx, Math.min(maxY, cy + Math.sin(angle) * ry)] as const;
  });
}

const MASS = {
  nape: symmetric([[512, 190], [636, 204], [740, 262], [790, 360], [802, 486], [792, 606], [764, 700], [726, 756], [630, 740], [512, 734]]),
  bob: symmetric([[512, 190], [636, 204], [740, 262], [788, 360], [800, 486], [796, 634], [782, 726], [746, 752], [630, 740], [512, 734]]),
  shoulder: symmetric([[512, 188], [638, 202], [744, 262], [796, 360], [810, 500], [808, 660], [796, 812], [770, 872], [650, 852], [512, 844]]),
  long: symmetric([[512, 188], [638, 202], [746, 262], [800, 360], [816, 520], [824, 760], [830, 1000], [812, 1100], [650, 1082], [512, 1072]]),
  volume: ellipse(512, 430, 372, 344, 26, 820),
};

/* ------------------------------------------------------------------ */
/* Shared fans                                                         */
/* ------------------------------------------------------------------ */

/** The top volume: locks sweeping from the crown out over the skull. */
const CANOPY: Fan[] = [
  { root: [[500, 256], [452, 276]], tip: [[368, 214], [276, 396]], count: 5, width: [74, 58], bend: [22, 30], vary: 18 },
  { root: [[524, 256], [572, 276]], tip: [[656, 214], [748, 396]], count: 5, width: [74, 58], bend: [-22, -30], vary: 18 },
  { root: [[476, 268], [548, 268]], tip: [[436, 200], [588, 200]], count: 4, width: [54, 54], bend: [12, -12], vary: 14 },
];

/** Short spikes that break the silhouette, for the messier styles. */
const TUFTS: Fan[] = [
  { root: [[420, 244], [330, 320]], tip: [[356, 176], [252, 300]], count: 3, width: [26, 22], bend: [14, 18], vary: 16 },
  { root: [[604, 244], [694, 320]], tip: [[668, 176], [772, 300]], count: 3, width: [26, 22], bend: [-14, -18], vary: 16 },
];

/** A fringe of separate strands with gaps between them. */
const FRINGE = {
  messy: [
    { root: [[506, 230], [468, 254]], tip: [[404, 536], [298, 456]], count: 5, width: [56, 38], bend: [58, 68], hook: [-54, -62], vary: 34 },
    { root: [[518, 230], [556, 254]], tip: [[620, 536], [726, 456]], count: 5, width: [56, 38], bend: [-58, -68], hook: [54, 62], vary: 34 },
    { root: [[498, 242], [468, 266]], tip: [[500, 482], [416, 500]], count: 3, width: [42, 32], bend: [40, 48], hook: [-40, -46], vary: 30 },
    { root: [[526, 242], [556, 266]], tip: [[524, 482], [608, 500]], count: 3, width: [42, 32], bend: [-40, -48], hook: [40, 46], vary: 30 },
  ] as Fan[],
  short: [
    { root: [[506, 242], [472, 262]], tip: [[424, 456], [328, 408]], count: 4, width: [50, 36], bend: [48, 58], hook: [-44, -50], vary: 24 },
    { root: [[518, 242], [552, 262]], tip: [[600, 456], [696, 408]], count: 4, width: [50, 36], bend: [-48, -58], hook: [44, 50], vary: 24 },
    { root: [[498, 248], [526, 248]], tip: [[466, 442], [558, 442]], count: 2, width: [36, 36], bend: [34, -34], hook: [-30, 30], vary: 22 },
  ] as Fan[],
  swept: [
    { root: [[430, 232], [444, 260]], tip: [[716, 410], [644, 500]], count: 6, width: [60, 40], bend: [66, 54], hook: [-46, -54], vary: 28 },
    { root: [[420, 250], [404, 292]], tip: [[336, 450], [300, 504]], count: 3, width: [42, 30], bend: [-32, -38], hook: [30, 34], vary: 20 },
  ] as Fan[],
  curtain: [
    { root: [[504, 226], [476, 248]], tip: [[348, 492], [300, 578]], count: 4, width: [62, 42], bend: [70, 62], hook: [-58, -64], vary: 30, mirror: true },
    { root: [[500, 242], [482, 266]], tip: [[408, 458], [370, 520]], count: 2, width: [42, 32], bend: [48, 44], hook: [-44, -48], vary: 24, mirror: true },
  ] as Fan[],
  blunt: [
    // A blunt fringe is cut straight, so it only curls a little at the ends
    { root: [[512, 246], [386, 274]], tip: [[494, 478], [328, 452]], count: 6, width: [58, 48], bend: [22, 30], hook: [-16, -22], vary: 14 },
    { root: [[512, 246], [638, 274]], tip: [[530, 478], [696, 452]], count: 6, width: [58, 48], bend: [-22, -30], hook: [16, 22], vary: 14 },
  ] as Fan[],
  wispy: [
    { root: [[532, 242], [566, 264]], tip: [[612, 400], [696, 458]], count: 3, width: [36, 24], bend: [-44, -52], hook: [40, 46], vary: 22 },
    { root: [[492, 242], [458, 264]], tip: [[412, 400], [328, 458]], count: 3, width: [36, 24], bend: [44, 52], hook: [-40, -46], vary: 22 },
  ] as Fan[],
  slick: [
    { root: [[492, 248], [462, 274]], tip: [[392, 392], [344, 446]], count: 2, width: [34, 24], bend: [46, 52], hook: [-38, -44], vary: 16, mirror: true },
  ] as Fan[],
};

/** Locks falling beside the face; layered, with tips at different heights. */
const SIDE = {
  jaw: [{ root: [[724, 330], [694, 392]], tip: [[772, 716], [714, 690]], count: 4, width: [58, 44], bend: [18, -10], vary: 40, mirror: true }] as Fan[],
  bob: [{ root: [[726, 330], [696, 392]], tip: [[776, 730], [716, 724]], count: 4, width: [62, 48], bend: [8, -6], vary: 24, mirror: true }] as Fan[],
  shoulder: [
    { root: [[726, 330], [694, 400]], tip: [[786, 860], [716, 806]], count: 4, width: [62, 46], bend: [20, -8], vary: 52, mirror: true },
    { root: [[744, 470], [756, 560]], tip: [[806, 880], [786, 920]], count: 2, width: [46, 40], bend: [16, 14], vary: 30, mirror: true },
  ] as Fan[],
  long: [
    { root: [[726, 330], [694, 400]], tip: [[796, 1060], [722, 1000]], count: 4, width: [66, 48], bend: [22, -8], vary: 60, mirror: true },
    { root: [[748, 480], [762, 580]], tip: [[824, 1080], [800, 1040]], count: 2, width: [50, 42], bend: [18, 14], vary: 40, mirror: true },
  ] as Fan[],
  wolf: [
    { root: [[724, 330], [696, 400]], tip: [[778, 640], [716, 618]], count: 4, width: [56, 42], bend: [20, -8], vary: 34, mirror: true },
    { root: [[744, 500], [760, 580]], tip: [[808, 872], [782, 900]], count: 2, width: [46, 38], bend: [16, 12], vary: 34, mirror: true },
  ] as Fan[],
  wisp: [{ root: [[700, 330], [690, 360]], tip: [[730, 560], [716, 600]], count: 2, width: [26, 20], bend: [10, 8], vary: 26, mirror: true }] as Fan[],
  pixie: [{ root: [[730, 380], [716, 420]], tip: [[762, 568], [736, 590]], count: 2, width: [40, 32], bend: [10, 6], vary: 20, mirror: true }] as Fan[],
};

/** The jagged ends of the hair behind the shoulders. */
const BACK = {
  nape: [{ root: [[760, 590], [688, 640]], tip: [[800, 796], [706, 810]], count: 3, width: [56, 46], bend: [16, -10], vary: 30, mirror: true }] as Fan[],
  shoulder: [{ root: [[780, 730], [706, 770]], tip: [[818, 936], [732, 944]], count: 3, width: [58, 46], bend: [16, -10], vary: 34, mirror: true }] as Fan[],
  long: [{ root: [[792, 940], [716, 968]], tip: [[828, 1140], [742, 1148]], count: 3, width: [60, 48], bend: [16, -10], vary: 36, mirror: true }] as Fan[],
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

type HairStyle = {
  mass?: ShapePoint[][];
  cap?: ShapePoint[];
  /** Behind the head: the ends of long hair, and the tucked side locks. */
  back?: Lock[];
  canopy?: Lock[];
  sides?: Lock[];
  bangs?: Lock[];
  /** Drawn behind the head, after the mass: buns and ponytails. */
  behind?: (context: DrawContext) => string;
  /** Drawn in front, after the bangs: braids. */
  front?: (context: DrawContext) => string;
  /** Buzzed hair is a tinted cap, not locks. */
  buzz?: boolean;
  /** Draws the notch where the hair parts in the middle, as the references do. */
  part?: boolean;
  /** Fine hairs escaping the silhouette; every style but the shortest has them. */
  wisps?: boolean;
};

function drawLocks(context: DrawContext, locks: readonly Lock[], back = false): string {
  const { hair, hairShade, hairDeep, hairStrand } = context.palette;
  return locks
    .map((lock) => {
      const d = lockPath(lock, context.texture);
      // Curly and coily hair ends in a ringlet, the way the reference sheets draw it
      const curl = lockCurl(lock, context.texture);
      const ringlet = curl
        ? stroke(curl.d, curl.width + 4, INK) + stroke(curl.d, curl.width, back ? hairShade : hair)
        : "";
      // A darker copy just behind each lock separates it from the one beneath
      return (
        fill(d, back ? hairDeep : hairShade, ` transform="translate(4 7)"`) +
        fill(d, back ? hairShade : hair) +
        stroke(lockStrand(lock, context.texture), 3.5, back ? hairDeep : hairStrand, ` opacity="0.85"`) +
        stroke(d, 4) +
        ringlet
      );
    })
    .join("");
}

function backLayer(style: HairStyle) {
  return (context: DrawContext) => {
    const { hair, hairShade } = context.palette;
    const mass = (style.mass ?? [])
      .map((shape) => {
        const d = texturedClosedPath(shape, context.texture);
        return fill(d, mix(hair, hairShade, 0.7)) + stroke(d, OUTLINE);
      })
      .join("");
    // Anything but straight hair tucks its side locks behind the ears
    const tucked = context.texture === "straight" ? [] : (style.sides ?? []);
    return inHead(mass + (style.behind?.(context) ?? "") + drawLocks(context, [...(style.back ?? []), ...tucked], true));
  };
}

function frontLayer(style: HairStyle) {
  return (context: DrawContext) => {
    const { hair, hairShade, hairStrand, skinDeep } = context.palette;
    const sides = context.texture === "straight" ? (style.sides ?? []) : [];
    const overFace = [...sides, ...(style.bangs ?? [])];

    // The hair's shadow on the forehead and cheeks, clipped to the face
    const faceClip = context.id("face-clip");
    context.def(`<clipPath id="${faceClip}"><path d="${context.face.path}"/></clipPath>`);
    const shadowShapes = [
      ...(style.cap ? [texturedClosedPath(style.cap, context.texture)] : []),
      ...overFace.map((lock) => lockPath(lock, context.texture)),
    ];
    const shadow = shadowShapes.length
      ? `<g clip-path="url(#${faceClip})" opacity="0.38">${shadowShapes.map((d) => fill(d, skinDeep, ` transform="translate(0 20)"`)).join("")}</g>`
      : "";

    let capArt = "";
    if (style.cap) {
      const d = texturedClosedPath(style.cap, style.buzz ? "straight" : context.texture);
      capArt = style.buzz
        ? fill(d, mix(hair, context.palette.skin, 0.3)) + stroke(d, OUTLINE, INK)
        : cel(context, "cap", d, hair, hairShade, [0, -12]);
    }

    // A soft sheen across the crown, as the reference has on dark hair
    const sheen = style.cap && !style.buzz
      ? stroke("M374 300 C432 246 592 242 662 296", 26, tint(hair, 0.22), ` opacity="0.45"`)
      : "";

    return inHead(
      shadow +
        capArt +
        sheen +
        (style.part ? fill(PARTING, hairShade) : "") +
        (style.wisps !== false && !style.buzz ? stroke(WISPS, 2.5, hairStrand, ` opacity="0.9"`) : "") +
        drawLocks(context, style.canopy ?? []) +
        drawLocks(context, sides) +
        drawLocks(context, style.bangs ?? []) +
        (style.front?.(context) ?? ""),
    );
  };
}

/** The little peak where a middle parting splits, drawn under the fringe. */
const PARTING = "M512 250 C500 276 496 300 500 322 C508 300 516 300 524 322 C528 300 524 276 512 250Z";

/** Fine hairs that escape the silhouette; they keep the outline from looking cut. */
const WISPS = [
  "M334 268 C300 236 282 262 276 292",
  "M690 268 C724 236 742 262 748 292",
  "M300 372 C268 356 256 384 260 410",
  "M724 372 C756 356 768 384 764 410",
  "M420 216 C400 186 372 190 356 208",
  "M604 216 C624 186 652 190 668 208",
].join(" ");

function hairStyle(id: string, label: string, style: HairStyle): Asset {
  return { id, label, layers: { backHair: backLayer(style), frontHair: frontLayer(style) } };
}

function bun(cx: number, cy: number, r: number) {
  return (context: DrawContext) => {
    const d = texturedClosedPath(ellipse(cx, cy, r, r * 0.9, 14), context.texture);
    return (
      cel(context, `bun-${cx}`, d, context.palette.hair, context.palette.hairShade, [-10, -10]) +
      stroke(
        `M${cx - r * 0.5} ${cy + r * 0.1} C${cx - r * 0.2} ${cy - r * 0.5} ${cx + r * 0.4} ${cy - r * 0.4} ${cx + r * 0.5} ${cy + r * 0.1}`,
        3,
        context.palette.hairStrand,
      )
    );
  };
}

function braids(context: DrawContext): string {
  const { hair, hairShade, hairStrand, metal } = context.palette;
  const braid = (side: 1 | -1) => {
    let art = "";
    for (let index = 9; index >= 0; index -= 1) {
      const x = 512 + side * (242 + (index % 2 === 0 ? -8 : 8) + index * 2);
      const y = 620 + index * 44;
      art += `<ellipse cx="${x}" cy="${y}" rx="${34 - index}" ry="29" fill="${index % 2 ? hair : hairShade}" stroke="${INK}" stroke-width="4"/>`;
      art += stroke(`M${x - side * 15} ${y - 12} Q${x} ${y + 6} ${x + side * 17} ${y - 8}`, 3, hairStrand);
    }
    const tipX = 512 + side * 260;
    const tipY = 620 + 10 * 44;
    return (
      art +
      `<rect x="${tipX - 16}" y="${tipY - 28}" width="32" height="16" rx="7" fill="${metal}" stroke="${INK}" stroke-width="3"/>` +
      fill(`M${tipX - 20} ${tipY - 12} Q${tipX} ${tipY + 44} ${tipX + 20} ${tipY - 12}Z`, hair, ` stroke="${INK}" stroke-width="4"`)
    );
  };
  return braid(1) + braid(-1);
}

function ponytail(context: DrawContext): string {
  return (
    drawLocks(
      context,
      fans({ root: [[672, 250], [706, 320]], tip: [[880, 620], [828, 840]], count: 4, width: [120, 84], bend: [-50, -24], vary: 50 }),
    ) +
    `<ellipse cx="672" cy="246" rx="20" ry="26" fill="${context.palette.metal}" stroke="${INK}" stroke-width="3" transform="rotate(-38 672 246)"/>`
  );
}

export const HAIR_STYLES = [
  hairStyle("messy", "Dağınık", {
    mass: [MASS.nape],
    cap: CAP,
    back: fans(...BACK.nape),
    canopy: fans(...CANOPY, ...TUFTS),
    sides: fans(...SIDE.jaw),
    bangs: fans(...FRINGE.messy),
  }),
  hairStyle("shortMessy", "Kısa dağınık", {
    cap: CAP,
    canopy: fans(...CANOPY, ...TUFTS, { root: [[474, 256], [550, 256]], tip: [[442, 186], [584, 186]], count: 4, width: [40, 40], bend: [10, -10], vary: 18 }),
    bangs: fans(...FRINGE.short),
  }),
  hairStyle("sidePart", "Yana taranmış", { cap: CAP, canopy: fans(...CANOPY), bangs: fans(...FRINGE.swept) }),
  hairStyle("pixie", "Pixie", { cap: CAP, canopy: fans(...CANOPY, ...TUFTS), sides: fans(...SIDE.pixie), bangs: fans(...FRINGE.swept) }),
  hairStyle("buzz", "Çok kısa", { cap: BUZZ_CAP, buzz: true }),
  hairStyle("bald", "Saçsız", {}),
  hairStyle("curtain", "Perdeli", {
    part: true,
    mass: [MASS.shoulder],
    cap: CAP,
    back: fans(...BACK.shoulder),
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.shoulder),
    bangs: fans(...FRINGE.curtain),
  }),
  hairStyle("bob", "Küt kâküllü", {
    mass: [MASS.bob],
    cap: CAP,
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.bob),
    bangs: fans(...FRINGE.blunt),
  }),
  hairStyle("wolf", "Katlı", {
    mass: [MASS.shoulder],
    cap: CAP,
    back: fans(...BACK.shoulder),
    canopy: fans(...CANOPY, ...TUFTS),
    sides: fans(...SIDE.wolf),
    bangs: fans(...FRINGE.messy),
  }),
  hairStyle("long", "Uzun", {
    part: true,
    mass: [MASS.long],
    cap: CAP,
    back: fans(...BACK.long),
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.long),
    bangs: fans(...FRINGE.curtain),
  }),
  hairStyle("longBangs", "Uzun kâküllü", {
    part: true,
    mass: [MASS.long],
    cap: CAP,
    back: fans(...BACK.long),
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.long),
    bangs: fans(...FRINGE.blunt),
  }),
  hairStyle("ponytail", "At kuyruğu", {
    cap: CAP,
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.wisp),
    bangs: fans(...FRINGE.slick),
    behind: ponytail,
  }),
  hairStyle("bun", "Topuz", {
    cap: CAP,
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.wisp),
    bangs: fans(...FRINGE.wispy),
    behind: bun(512, 168, 92),
  }),
  hairStyle("spaceBuns", "İki topuz", {
    part: true,
    cap: CAP,
    canopy: fans(...CANOPY),
    sides: fans(...SIDE.wisp),
    bangs: fans(...FRINGE.curtain),
    behind: (c) => bun(356, 206, 74)(c) + bun(668, 206, 74)(c),
  }),
  hairStyle("braids", "Örgü", {
    part: true, cap: CAP, canopy: fans(...CANOPY), bangs: fans(...FRINGE.curtain), front: braids }),
  hairStyle("volume", "Hacimli", { mass: [MASS.volume], cap: CAP, canopy: fans(...CANOPY, ...TUFTS), bangs: fans(...FRINGE.short) }),
] as const satisfies readonly Asset[];
