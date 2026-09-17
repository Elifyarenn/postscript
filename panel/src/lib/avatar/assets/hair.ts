/**
 * Hair (D-195): styles, textures and colours, in head space.
 *
 * A style is a set of pieces: a mass behind the head, a cap over the skull,
 * locks falling at the sides and locks over the forehead. Each lock is drawn
 * on its own with a darker copy slightly behind it, which is what gives the
 * hair separate locks and volume. The texture bends every lock (a wave, a
 * curl, a coil) and scallops the silhouette, so one style works in all four.
 *
 * Side locks follow the texture: straight hair falls straight down in front
 * of the ears, as the product owner asked, while wavy and curly hair stays
 * tucked behind them, the way the reference drawing shows it with its
 * piercings on view (D-195).
 */
import { INK, OUTLINE, cel, fill, inHead, stroke, type DrawContext } from "../canvas";
import {
  lockPath,
  lockStrand,
  mirrorLock,
  mirrorX,
  mix,
  symmetric,
  texturedClosedPath,
  type Lock,
  type Point,
  type ShapePoint,
} from "../geometry";
import type { Asset, ColorOption } from "./types";

export const HAIR_COLORS = [
  { id: "black", label: "Siyah", hex: "#1f1a1c" },
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
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const both = (locks: readonly Lock[]): Lock[] => [...locks, ...locks.map((lock) => mirrorLock(lock))];

/** Mirrors a right half into an outline running left bottom → top → right bottom. */
function arch(right: readonly Point[]): Point[] {
  return [...right.slice(1).map((point) => mirrorX(point)).reverse(), ...right];
}

/** The skull cover: textured outer edge, smooth hairline tucked under the bangs. */
function cap(outerRight: readonly Point[], hairline: readonly Point[]): ShapePoint[] {
  const outer = arch(outerRight);
  return [
    ...outer.slice(0, -1).map((p) => [p[0], p[1], true] as const),
    [outer[outer.length - 1]![0], outer[outer.length - 1]![1], false] as const,
    ...hairline.map((p) => [p[0], p[1], false] as const),
  ];
}

const CAP = cap(
  [[512, 168], [632, 184], [724, 244], [774, 344], [784, 430], [766, 474]],
  [[718, 468], [704, 404], [672, 334], [602, 292], [512, 282], [422, 292], [352, 334], [320, 404], [306, 468]],
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
  nape: symmetric([[512, 160], [648, 174], [756, 236], [812, 348], [826, 480], [816, 610], [786, 712], [744, 772], [640, 752], [512, 744]]),
  bob: symmetric([[512, 160], [648, 174], [756, 236], [808, 350], [822, 480], [818, 640], [804, 736], [764, 762], [640, 750], [512, 744]]),
  shoulder: symmetric([[512, 158], [650, 172], [760, 236], [818, 350], [832, 500], [830, 660], [818, 820], [790, 884], [660, 862], [512, 852]]),
  long: symmetric([[512, 158], [650, 172], [762, 236], [822, 350], [838, 520], [846, 760], [852, 1000], [832, 1110], [660, 1090], [512, 1080]]),
  volume: ellipse(512, 440, 396, 362, 26, 830),
};

const BACK = {
  nape: both([[770, 620, 802, 796, 70, 20], [700, 664, 716, 806, 60, -14]]),
  shoulder: both([[790, 760, 822, 930, 74, 20], [720, 786, 742, 936, 64, -12]]),
  long: both([[800, 960, 832, 1136, 78, 18], [730, 984, 752, 1146, 66, -12]]),
};

const SIDES = {
  jaw: both([[744, 360, 772, 724, 86, 20], [708, 410, 718, 704, 66, -12]]),
  bob: both([[746, 360, 774, 736, 96, 8], [708, 410, 716, 728, 74, -6]]),
  shoulder: both([[744, 360, 782, 866, 88, 22], [710, 420, 722, 826, 70, -14], [762, 560, 802, 906, 70, 16]]),
  long: both([[744, 360, 792, 1066, 92, 26], [710, 420, 728, 1006, 72, -14], [770, 580, 822, 1086, 74, 18]]),
  wolf: both([[744, 360, 778, 646, 80, 24], [762, 540, 806, 866, 72, 18], [708, 430, 718, 724, 60, -10]]),
  wisp: both([[694, 300, 726, 590, 40, 12]]),
  pixie: both([[744, 400, 758, 566, 54, 8]]),
};

const blunt = (tipY: number): Lock[] =>
  [380, 424, 468, 512, 556, 600, 644].map((x, index) => [x, 250, 512 + (x - 512) * 1.12, tipY, 84, index % 2 ? 5 : -5] as const);

const BANGS = {
  messy: [
    [330, 300, 290, 500, 70, -16],
    [694, 300, 734, 500, 70, 16],
    [410, 250, 350, 472, 88, -22],
    [616, 246, 690, 462, 86, 24],
    [470, 226, 418, 480, 92, -18],
    [560, 222, 606, 472, 92, 20],
    [516, 214, 500, 492, 84, -8],
    [592, 236, 540, 440, 56, -18],
  ] as Lock[],
  short: [
    [470, 240, 440, 150, 70, -14],
    [560, 236, 600, 146, 70, 16],
    [512, 240, 520, 130, 64, 6],
    [360, 300, 320, 440, 66, -12],
    [664, 300, 704, 440, 66, 12],
    [430, 240, 384, 420, 80, -16],
    [594, 238, 646, 416, 80, 18],
    [500, 220, 472, 430, 82, -10],
    [556, 224, 588, 420, 70, 12],
  ] as Lock[],
  swept: [
    [400, 230, 330, 470, 70, -10],
    [650, 250, 740, 490, 70, 18],
    [470, 232, 540, 480, 80, 24],
    [440, 222, 700, 468, 100, 40],
    [430, 214, 600, 420, 110, 44],
  ] as Lock[],
  pixie: [
    [420, 236, 360, 470, 80, -14],
    [640, 250, 740, 500, 70, 16],
    [520, 220, 700, 470, 96, 34],
    [470, 224, 610, 452, 110, 36],
  ] as Lock[],
  curtain: both([[500, 214, 380, 470, 96, 34], [480, 224, 318, 520, 80, 30]]),
  part: both([[500, 220, 420, 420, 80, 24]]),
  blunt: blunt(452),
  long: blunt(474),
  slick: [[560, 240, 612, 380, 40, 16]] as Lock[],
};

/** Stray hairs over the crown, for the looser textures. */
const FLYAWAYS = "M600 176 C640 130 690 140 700 170 M430 180 C400 140 360 150 350 176 M760 300 C800 280 822 302 812 332";

type HairStyle = {
  mass?: ShapePoint[][];
  back?: readonly Lock[];
  cap?: ShapePoint[];
  sides?: readonly Lock[];
  bangs?: readonly Lock[];
  /** Drawn behind the head, after the mass: buns and ponytails. */
  behind?: (context: DrawContext) => string;
  /** Drawn in front, after the bangs: braids. */
  front?: (context: DrawContext) => string;
  flyaways?: boolean;
  /** Buzzed hair is a tinted cap, not locks. */
  buzz?: boolean;
};

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function drawLocks(context: DrawContext, locks: readonly Lock[], back = false): string {
  const { hair, hairShade, hairDeep, hairStrand } = context.palette;
  return locks
    .map((lock) => {
      const d = lockPath(lock, context.texture);
      // A darker copy just behind each lock separates it from the one beneath
      return (
        fill(d, back ? hairDeep : hairShade, ` transform="translate(5 8)"`) +
        fill(d, back ? hairShade : hair) +
        stroke(lockStrand(lock, context.texture), 4, back ? hairDeep : hairStrand, ` opacity="0.85"`) +
        stroke(d, 4.5)
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
        return fill(d, mix(hair, hairShade, 0.6)) + stroke(d, OUTLINE);
      })
      .join("");
    // Anything but straight hair tucks its side locks behind the ears
    const tucked = context.texture === "straight" ? [] : (style.sides ?? []);
    return inHead(mass + (style.behind?.(context) ?? "") + drawLocks(context, [...(style.back ?? []), ...tucked], true));
  };
}

function frontLayer(style: HairStyle) {
  return (context: DrawContext) => {
    const { hair, hairShade, skinDeep } = context.palette;
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
      ? `<g clip-path="url(#${faceClip})" opacity="0.4">${shadowShapes.map((d) => fill(d, skinDeep, ` transform="translate(0 18)"`)).join("")}</g>`
      : "";

    let capArt = "";
    if (style.cap) {
      const d = texturedClosedPath(style.cap, style.buzz ? "straight" : context.texture);
      capArt = style.buzz
        ? fill(d, mix(hair, context.palette.skin, 0.3)) + stroke(d, OUTLINE, INK)
        : cel(context, "cap", d, hair, hairShade, [0, -14]);
    }

    return inHead(
      shadow +
        capArt +
        drawLocks(context, sides) +
        drawLocks(context, style.bangs ?? []) +
        (style.front?.(context) ?? "") +
        (style.flyaways && context.texture !== "straight" ? stroke(FLYAWAYS, 3) : ""),
    );
  };
}

function hairStyle(id: string, label: string, style: HairStyle): Asset {
  return { id, label, layers: { backHair: backLayer(style), frontHair: frontLayer(style) } };
}

function bun(cx: number, cy: number, r: number) {
  return (context: DrawContext) => {
    const d = texturedClosedPath(ellipse(cx, cy, r, r * 0.9, 14), context.texture);
    return cel(context, `bun-${cx}`, d, context.palette.hair, context.palette.hairShade, [-10, -10]) +
      stroke(`M${cx - r * 0.5} ${cy + r * 0.1} C${cx - r * 0.2} ${cy - r * 0.5} ${cx + r * 0.4} ${cy - r * 0.4} ${cx + r * 0.5} ${cy + r * 0.1}`, 3, context.palette.hairStrand);
  };
}

function braids(context: DrawContext): string {
  const { hair, hairShade, hairStrand, metal } = context.palette;
  const braid = (side: 1 | -1) => {
    let art = "";
    for (let index = 9; index >= 0; index -= 1) {
      const x = 512 + side * (246 + (index % 2 === 0 ? -8 : 8) + index * 2);
      const y = 640 + index * 44;
      art += `<ellipse cx="${x}" cy="${y}" rx="${36 - index}" ry="30" fill="${index % 2 ? hair : hairShade}" stroke="${INK}" stroke-width="4.5"/>`;
      art += stroke(`M${x - side * 16} ${y - 12} Q${x} ${y + 6} ${x + side * 18} ${y - 8}`, 3, hairStrand);
    }
    const tipX = 512 + side * 264;
    const tipY = 640 + 10 * 44;
    return (
      art +
      `<rect x="${tipX - 16}" y="${tipY - 28}" width="32" height="16" rx="7" fill="${metal}" stroke="${INK}" stroke-width="3"/>` +
      fill(`M${tipX - 20} ${tipY - 12} Q${tipX} ${tipY + 44} ${tipX + 20} ${tipY - 12}Z`, hair, ` stroke="${INK}" stroke-width="4.5"`)
    );
  };
  return braid(1) + braid(-1);
}

function ponytail(context: DrawContext): string {
  const tail: Lock[] = [
    [700, 250, 872, 640, 150, -50],
    [720, 290, 850, 790, 120, -30],
    [740, 330, 820, 850, 90, -12],
  ];
  return drawLocks(context, tail) + `<ellipse cx="664" cy="232" rx="20" ry="26" fill="${context.palette.metal}" stroke="${INK}" stroke-width="3" transform="rotate(-38 664 232)"/>`;
}

export const HAIR_STYLES = [
  hairStyle("messy", "Dağınık", { mass: [MASS.nape], back: BACK.nape, cap: CAP, sides: SIDES.jaw, bangs: BANGS.messy, flyaways: true }),
  hairStyle("shortMessy", "Kısa dağınık", { cap: CAP, bangs: BANGS.short, flyaways: true }),
  hairStyle("sidePart", "Yana taranmış", { cap: CAP, bangs: BANGS.swept }),
  hairStyle("pixie", "Pixie", { cap: CAP, sides: SIDES.pixie, bangs: BANGS.pixie }),
  hairStyle("buzz", "Çok kısa", { cap: BUZZ_CAP, buzz: true }),
  hairStyle("bald", "Saçsız", {}),
  hairStyle("curtain", "Perdeli", { mass: [MASS.shoulder], back: BACK.shoulder, cap: CAP, sides: SIDES.shoulder, bangs: BANGS.curtain }),
  hairStyle("bob", "Küt kâküllü", { mass: [MASS.bob], cap: CAP, sides: SIDES.bob, bangs: BANGS.blunt }),
  hairStyle("wolf", "Katlı", { mass: [MASS.shoulder], back: BACK.shoulder, cap: CAP, sides: SIDES.wolf, bangs: BANGS.messy, flyaways: true }),
  hairStyle("long", "Uzun", { mass: [MASS.long], back: BACK.long, cap: CAP, sides: SIDES.long, bangs: BANGS.curtain }),
  hairStyle("longBangs", "Uzun kâküllü", { mass: [MASS.long], back: BACK.long, cap: CAP, sides: SIDES.long, bangs: BANGS.long }),
  hairStyle("ponytail", "At kuyruğu", { cap: CAP, sides: SIDES.wisp, bangs: BANGS.slick, behind: ponytail }),
  hairStyle("bun", "Topuz", { cap: CAP, sides: SIDES.wisp, bangs: BANGS.slick, behind: bun(512, 150, 96) }),
  hairStyle("spaceBuns", "İki topuz", { cap: CAP, sides: SIDES.wisp, bangs: BANGS.part, behind: (c) => bun(350, 196, 76)(c) + bun(674, 196, 76)(c) }),
  hairStyle("braids", "Örgü", { cap: CAP, bangs: BANGS.curtain, front: braids }),
  hairStyle("volume", "Hacimli", { mass: [MASS.volume], cap: CAP, bangs: BANGS.short, flyaways: true }),
] as const satisfies readonly Asset[];
