/**
 * The team avatar renderer (D-194): configuration in, SVG text out.
 *
 * One pure function draws every avatar, in the browser for the live preview
 * and on the server for the PNG, so what a member sees is exactly what the
 * admin downloads. The drawing is a stack of layers on a fixed 1024 canvas:
 * every face, eye and hair style shares the same head position, crop and line
 * weight, which is what keeps the whole team in one illustration style.
 *
 * The style: medium-thin warm dark outlines, flat fills, one step of cel shade
 * (the fill is laid over its own shade colour, nudged towards the light, so a
 * thin crescent of shadow is left on the far side), no textures, no gradients.
 * The canvas has no background element, so the image is transparent.
 *
 * Safety: every value placed in the markup comes from the fixed catalogue in
 * `options.ts` or from numbers in this file. Nothing typed by a member reaches
 * the SVG.
 */
import {
  EYE_COLORS,
  GLASSES_COLORS,
  HAIR_COLORS,
  JEWELRY_COLORS,
  LIP_COLORS,
  SKIN_TONES,
  TOP_COLORS,
  type AvatarConfig,
} from "./options";
import {
  luminance,
  mirrorX,
  mix,
  shade,
  smoothClosedPath,
  smoothOpenPath,
  symmetric,
  texturedClosedPath,
  textureStrands,
  tint,
  type Point,
  type ShapePoint,
} from "./geometry";

export const AVATAR_CANVAS = 1024;

const INK = "#2b1d1f";
const OUTLINE = 7;
const DETAIL = 5;
const CX = 512;

type Palette = {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStrand: string;
  brow: string;
  eye: string;
  lip: string;
  top: string;
  topShade: string;
  glasses: string;
  metal: string;
};

type Context = {
  config: AvatarConfig;
  palette: Palette;
  defs: string[];
  /** Face outline and its right half, shared by the head, beard and shadows. */
  face: { path: string; right: readonly Point[] };
  earShift: number;
};

type Layer = (context: Context) => string;

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

function hexOf<T extends readonly { id: string; hex: string }[]>(list: T, id: string): string {
  return list.find((entry) => entry.id === id)?.hex ?? list[0]!.hex;
}

function fillPath(d: string, fill: string, extra = ""): string {
  return `<path d="${d}" fill="${fill}"${extra}/>`;
}

function strokePath(d: string, width = OUTLINE, color = INK, extra = ""): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${extra}/>`;
}

/**
 * A filled, outlined shape with one step of cel shading: the shade colour
 * underneath and the base colour on top, shifted towards the light (upper
 * left) and clipped to the shape, which leaves a shadow on the far edges.
 */
function celShape(
  context: Context,
  id: string,
  d: string,
  base: string,
  shadow: string,
  offset: Point = [-14, -8],
  outline = true,
): string {
  context.defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`);
  return [
    fillPath(d, shadow),
    // The clip sits on a wrapper: on the moved path itself it would move along
    `<g clip-path="url(#${id})"><path d="${d}" fill="${base}" transform="translate(${-offset[0]} ${-offset[1]})"/></g>`,
    outline ? strokePath(d) : "",
  ].join("");
}

/** A ring drawn as an outlined metal stroke, used by hoops and piercings. */
function ring(d: string, metal: string, width = 6): string {
  return strokePath(d, width + 4, INK) + strokePath(d, width, metal);
}

function bead(x: number, y: number, r: number, fill: string): string {
  return (
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${Math.max(1.5, r * 0.28)}" fill="#ffffff" opacity="0.8"/>`
  );
}

/** Deterministic pseudo random numbers, so freckles land on the same spots every time. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/* ------------------------------------------------------------------ */
/* Head geometry                                                       */
/* ------------------------------------------------------------------ */

/** Right half of each face, from the top of the forehead to the chin. */
const FACE_RIGHT: Record<AvatarConfig["faceShape"], Point[]> = {
  oval: [[512, 258], [600, 268], [662, 318], [688, 410], [686, 510], [668, 600], [626, 668], [572, 708], [512, 720]],
  round: [[512, 262], [606, 272], [672, 326], [698, 420], [698, 520], [680, 608], [634, 670], [576, 704], [512, 712]],
  square: [[512, 258], [604, 266], [668, 316], [692, 410], [692, 520], [688, 612], [666, 674], [602, 706], [512, 712]],
  heart: [[512, 256], [612, 266], [682, 318], [702, 408], [692, 500], [664, 588], [618, 660], [562, 710], [512, 730]],
  long: [[512, 248], [596, 258], [656, 310], [680, 410], [680, 520], [666, 624], [628, 704], [572, 744], [512, 756]],
  diamond: [[512, 258], [584, 270], [640, 322], [680, 420], [696, 502], [672, 592], [624, 666], [566, 714], [512, 730]],
};

const EAR_RIGHT: Point[] = [[676, 470], [708, 456], [732, 488], [728, 540], [706, 580], [680, 588]];

/* ------------------------------------------------------------------ */
/* Body and clothing                                                   */
/* ------------------------------------------------------------------ */

const SHOULDERS_RIGHT: Point[] = [[652, 806], [744, 838], [824, 884], [872, 950], [900, 1070]];

/** Shoulders with a given neckline, listed from the left end of the neckline to the right. */
function torsoPoints(neckline: readonly Point[]): Point[] {
  const left = SHOULDERS_RIGHT.map((point) => mirrorX(point)).reverse();
  return [...left, ...neckline, ...SHOULDERS_RIGHT, [CX, 1110]];
}

const NECKLINES = {
  closed: [[420, 792], [512, 780], [604, 792]],
  crew: [[440, 792], [470, 828], [512, 842], [554, 828], [584, 792]],
  deepCrew: [[436, 796], [470, 836], [512, 850], [554, 836], [588, 796]],
  vneck: [[434, 790], [474, 850], [506, 896], [518, 896], [550, 850], [590, 790]],
  collar: [[452, 796], [484, 836], [506, 868], [518, 868], [540, 836], [572, 796]],
  turtle: [[452, 812], [452, 712], [512, 722], [572, 712], [572, 812]],
} satisfies Record<string, Point[]>;

const NECK = "M458 590 L566 590 C566 690 572 760 590 812 L434 812 C452 760 458 690 458 590Z";

/* ------------------------------------------------------------------ */
/* Hair                                                                */
/* ------------------------------------------------------------------ */

type HairStyle = {
  /** Behind the head and ears. */
  back?: ShapePoint[][];
  /** In front of the shoulders but behind the head (long hair, braids). */
  over?: ShapePoint[][];
  /** Over the forehead; its lower edge is the hairline. */
  front?: ShapePoint[];
  /** Guides for the texture strokes inside the front shape. */
  strands?: Point[][];
  /**
   * The front sits inside a larger back shape (an afro): only its hairline is
   * outlined, otherwise a second contour would cut through the volume.
   */
  blend?: boolean;
  /** Extra drawing on top of the over layer, such as braid segments. */
  overArt?: (context: Context) => string;
};

const CAP_RIGHT: Point[] = [[512, 196], [612, 212], [684, 268], [716, 352], [714, 452]];

/** Mirrors a right half into a full outline running left bottom → top → right bottom. */
function arch(right: readonly Point[]): Point[] {
  const left = right.slice(1).map((point) => mirrorX(point)).reverse();
  return [...left, ...right];
}

/** A front hair shape: a textured outer edge and a smooth hairline back across. */
function cap(outer: readonly Point[], hairline: readonly Point[]): ShapePoint[] {
  return [
    ...outer.slice(0, -1).map((p) => [p[0], p[1], true] as const),
    [outer[outer.length - 1]![0], outer[outer.length - 1]![1], false] as const,
    ...hairline.map((p) => [p[0], p[1], false] as const),
  ];
}

function mirrorShape(shape: readonly ShapePoint[]): ShapePoint[] {
  return shape.map((p) => [CX * 2 - p[0], p[1], p[2] !== false] as const);
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, count: number, maxY = Infinity): ShapePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * rx, Math.min(maxY, cy + Math.sin(angle) * ry)] as const;
  });
}

const SLICK_HAIRLINE: Point[] = [[694, 460], [668, 452], [664, 380], [636, 326], [580, 306], [512, 300], [444, 306], [388, 326], [360, 380], [356, 452], [330, 460]];
const MIDDLE_PART_HAIRLINE: Point[] = [[700, 470], [674, 462], [664, 390], [630, 330], [570, 300], [512, 272], [454, 300], [394, 330], [360, 390], [350, 462], [324, 470]];

const HAIR: Record<AvatarConfig["hairStyle"], HairStyle> = {
  bald: {},
  buzz: {
    front: cap(arch([[512, 222], [604, 234], [668, 282], [696, 360], [694, 450]]), [
      [678, 454], [664, 440], [658, 370], [620, 322], [512, 312], [404, 322], [366, 370], [360, 440], [346, 454],
    ]),
  },
  crop: {
    front: cap(arch(CAP_RIGHT), [
      [694, 460], [668, 452], [660, 380], [630, 334], [580, 320], [540, 338], [512, 324], [480, 340], [436, 320], [392, 336], [364, 380], [356, 452], [330, 460],
    ]),
    strands: [[[440, 220], [470, 270], [480, 320]], [[570, 220], [590, 270], [600, 312]]],
  },
  sidePart: {
    front: cap(
      [[306, 456], [300, 360], [330, 258], [410, 192], [520, 176], [622, 198], [690, 258], [718, 350], [716, 452]],
      [[694, 460], [668, 452], [662, 370], [632, 316], [560, 292], [480, 302], [410, 342], [372, 402], [352, 456], [328, 462]],
    ),
    strands: [[[566, 186], [548, 240], [540, 290]], [[480, 196], [420, 250], [376, 340]], [[620, 214], [652, 280], [666, 350]]],
  },
  quiff: {
    front: cap(
      [[312, 452], [304, 350], [336, 246], [406, 176], [500, 136], [600, 146], [676, 206], [716, 300], [716, 452]],
      [[694, 460], [668, 452], [664, 360], [624, 308], [512, 296], [400, 308], [362, 360], [354, 452], [330, 460]],
    ),
    strands: [[[400, 230], [480, 170], [590, 168]], [[430, 280], [520, 236], [640, 250]]],
  },
  pixie: {
    front: cap(arch(CAP_RIGHT), [
      [694, 460], [668, 452], [668, 392], [652, 344], [604, 364], [540, 384], [470, 394], [420, 404], [380, 424], [356, 456], [330, 462],
    ]),
    strands: [[[610, 214], [530, 290], [440, 380]], [[670, 270], [610, 330], [540, 376]]],
  },
  curtain: {
    back: [symmetric([[512, 188], [630, 206], [708, 270], [742, 380], [748, 520], [738, 640], [700, 700], [600, 690], [512, 680]])],
    front: cap(arch(CAP_RIGHT), [
      [700, 470], [672, 462], [664, 400], [636, 350], [580, 330], [530, 300], [512, 282], [494, 300], [444, 330], [388, 350], [360, 400], [352, 462], [324, 470],
    ]),
    strands: [[[512, 206], [560, 262], [620, 330], [658, 420]], [[512, 206], [464, 262], [404, 330], [366, 420]]],
  },
  bob: {
    back: [symmetric([[512, 190], [636, 210], [716, 280], [746, 400], [742, 560], [724, 650], [700, 674], [600, 664], [512, 658]])],
    front: cap(arch(CAP_RIGHT), [
      [700, 466], [674, 460], [670, 420], [640, 412], [512, 408], [384, 412], [354, 420], [350, 460], [324, 466],
    ]),
    strands: [[[460, 214], [452, 300], [446, 400]], [[570, 214], [578, 300], [584, 400]]],
  },
  shoulder: {
    back: [symmetric([[512, 188], [640, 206], [724, 276], [752, 400], [756, 560], [750, 700], [730, 792], [640, 762], [512, 742]])],
    front: cap(arch(CAP_RIGHT), [
      [700, 470], [672, 462], [666, 390], [640, 330], [580, 304], [500, 312], [430, 352], [380, 412], [356, 462], [328, 470],
    ]),
    strands: [[[560, 196], [480, 260], [400, 360]], [[640, 220], [660, 300], [672, 400]]],
  },
  shag: {
    back: [symmetric([[512, 180], [642, 196], [730, 266], [766, 380], [768, 520], [748, 640], [716, 722], [640, 702], [512, 692]])],
    front: cap(arch([[512, 186], [616, 202], [694, 262], [728, 352], [724, 470]]), [
      [706, 480], [676, 470], [668, 410], [640, 380], [600, 394], [560, 366], [512, 382], [464, 366], [424, 394], [384, 380], [356, 410], [348, 470], [318, 480],
    ]),
    strands: [[[512, 200], [500, 290], [470, 360]], [[600, 214], [620, 300], [640, 370]], [[424, 214], [404, 300], [384, 370]]],
  },
  long: {
    back: [symmetric([[512, 186], [640, 204], [728, 276], [758, 400], [764, 580], [760, 760], [700, 800], [512, 790]])],
    over: [
      [[616, 600], [700, 560], [750, 620], [768, 760], [786, 900], [744, 944], [688, 904], [654, 800], [626, 700]],
      mirrorShape([[616, 600], [700, 560], [750, 620], [768, 760], [786, 900], [744, 944], [688, 904], [654, 800], [626, 700]]),
    ],
    front: cap(arch(CAP_RIGHT), MIDDLE_PART_HAIRLINE),
    strands: [[[512, 206], [570, 250], [636, 320], [666, 420]], [[512, 206], [454, 250], [388, 320], [358, 420]]],
  },
  ponytail: {
    back: [[[640, 250], [730, 270], [800, 350], [812, 470], [808, 600], [820, 720], [770, 770], [744, 660], [738, 540], [716, 420], [660, 330]]],
    front: cap(arch(CAP_RIGHT), SLICK_HAIRLINE),
    strands: [[[430, 230], [520, 214], [640, 250]], [[400, 300], [500, 262], [620, 290]]],
  },
  bun: {
    back: [ellipsePoints(512, 164, 82, 74, 14)],
    front: cap(arch(CAP_RIGHT), SLICK_HAIRLINE),
    strands: [[[420, 250], [512, 214], [604, 250]], [[390, 330], [512, 280], [634, 330]]],
  },
  spaceBuns: {
    back: [ellipsePoints(372, 214, 70, 66, 12), ellipsePoints(652, 214, 70, 66, 12)],
    front: cap(arch(CAP_RIGHT), MIDDLE_PART_HAIRLINE),
    strands: [[[512, 206], [570, 250], [636, 320]], [[512, 206], [454, 250], [388, 320]]],
  },
  braids: {
    back: [symmetric([[512, 188], [636, 206], [720, 274], [748, 390], [742, 520], [706, 592], [512, 600]])],
    front: cap(arch(CAP_RIGHT), MIDDLE_PART_HAIRLINE),
    strands: [[[512, 206], [570, 250], [636, 320], [666, 420]], [[512, 206], [454, 250], [388, 320], [358, 420]]],
    overArt: (context) => {
      const { hair, hairShade, hairStrand } = context.palette;
      const braid = (side: 1 | -1) => {
        let art = "";
        for (let index = 7; index >= 0; index -= 1) {
          const x = CX + side * (196 + (index % 2 === 0 ? -6 : 6));
          const y = 596 + index * 42;
          art += `<ellipse cx="${x}" cy="${y}" rx="${32 - index}" ry="28" fill="${index % 2 ? hair : hairShade}" stroke="${INK}" stroke-width="${DETAIL}"/>`;
          art += strokePath(`M${x - side * 14} ${y - 12} Q${x} ${y + 4} ${x + side * 16} ${y - 8}`, 3, hairStrand);
        }
        const tip = 596 + 8 * 42;
        art += `<rect x="${CX + side * 196 - 14}" y="${tip - 26}" width="28" height="14" rx="6" fill="${context.palette.metal}" stroke="${INK}" stroke-width="3"/>`;
        art += fillPath(
          `M${CX + side * 196 - 18} ${tip - 12} Q${CX + side * 196} ${tip + 40} ${CX + side * 196 + 18} ${tip - 12}Z`,
          hair,
          ` stroke="${INK}" stroke-width="${DETAIL}"`,
        );
        return art;
      };
      return braid(1) + braid(-1);
    },
  },
  afro: {
    blend: true,
    back: [ellipsePoints(512, 392, 304, 286, 22, 640)],
    front: cap(arch(CAP_RIGHT), [
      [694, 460], [670, 452], [664, 370], [630, 320], [512, 306], [394, 320], [360, 370], [354, 452], [330, 460],
    ]),
    strands: [[[380, 200], [512, 150], [644, 200]], [[300, 330], [260, 440], [290, 560]], [[724, 330], [764, 440], [734, 560]]],
  },
};

/* ------------------------------------------------------------------ */
/* Layers, back to front                                               */
/* ------------------------------------------------------------------ */

const hairBack: Layer = (context) => {
  const style = HAIR[context.config.hairStyle];
  if (!style.back) return "";
  const { hairShade, hair } = context.palette;
  // The hair behind the head sits in shadow; a darker fill gives the depth for free
  return style.back
    .map((shape) => {
      const d = texturedClosedPath(shape, context.config.hairTexture);
      return fillPath(d, mix(hair, hairShade, 0.55)) + strokePath(d);
    })
    .join("");
};

const torso: Layer = (context) => {
  const { skin, skinShade } = context.palette;
  const d = smoothClosedPath(torsoPoints(NECKLINES.closed), 0.7);
  return celShape(context, "torso-skin", d, skin, skinShade, [-16, 6]);
};

const neck: Layer = (context) => {
  const { skin, skinShade } = context.palette;
  context.defs.push(`<clipPath id="neck"><path d="${NECK}"/></clipPath>`);
  return [
    fillPath(NECK, mix(skin, skinShade, 0.3)),
    // The chin casts its own outline down onto the neck
    `<g clip-path="url(#neck)"><path d="${context.face.path}" fill="${skinShade}" transform="translate(0 38)"/></g>`,
    strokePath("M458 600 C458 690 452 760 434 812"),
    strokePath("M566 600 C566 690 572 760 590 812"),
  ].join("");
};

const clothing: Layer = (context) => {
  const { top, topShade } = context.palette;
  const body = (neckline: readonly Point[], id = "top") =>
    celShape(context, id, smoothClosedPath(torsoPoints(neckline), 0.7), top, topShade, [-18, 8]);
  const trim = (d: string) => fillPath(d, shade(top, 0.12)) + strokePath(d, DETAIL);

  switch (context.config.top) {
    case "tshirt":
      return (
        body(NECKLINES.crew) +
        trim(smoothClosedPath([[440, 792], [470, 828], [512, 842], [554, 828], [584, 792], [596, 800], [560, 842], [512, 856], [464, 842], [428, 800]], 0.8))
      );
    case "vneck":
      return body(NECKLINES.vneck) + strokePath("M446 804 L512 904 L578 804", DETAIL, shade(top, 0.3));
    case "sweater":
      return (
        body(NECKLINES.crew) +
        trim(smoothClosedPath([[440, 792], [470, 828], [512, 842], [554, 828], [584, 792], [604, 802], [562, 858], [512, 872], [462, 858], [420, 802]], 0.8)) +
        strokePath("M436 860 C380 900 300 910 236 930", 4, shade(top, 0.3)) +
        strokePath("M588 860 C644 900 724 910 788 930", 4, shade(top, 0.3))
      );
    case "turtleneck":
      return (
        body(NECKLINES.turtle) +
        strokePath("M456 756 C482 770 542 770 568 756", 4, shade(top, 0.35)) +
        strokePath("M454 790 C482 806 542 806 570 790", 4, shade(top, 0.35))
      );
    case "hoodie": {
      const hood = smoothClosedPath(
        [[388, 806], [430, 882], [512, 908], [594, 882], [636, 806], [588, 796], [554, 836], [512, 850], [470, 836], [436, 796]],
        0.8,
      );
      const string = (x: number, lean: number) =>
        strokePath(`M${x} 884 C${x - lean} 920 ${x - lean} 950 ${x - lean * 2} 990`, 11) +
        strokePath(`M${x} 884 C${x - lean} 920 ${x - lean} 950 ${x - lean * 2} 990`, 6, tint(top, 0.55));
      return body(NECKLINES.deepCrew) + fillPath(hood, shade(top, 0.1)) + strokePath(hood) + string(482, 4) + string(542, -4);
    }
    case "shirt": {
      const flap = (side: 1 | -1) => {
        const points: Point[] = [[452, 790], [420, 846], [500, 884], [512, 868]];
        const d = smoothClosedPath(side === 1 ? points : points.map((p) => mirrorX(p)), 0.3);
        return fillPath(d, tint(top, 0.12)) + strokePath(d, DETAIL);
      };
      return (
        body(NECKLINES.collar) +
        strokePath("M512 880 L512 1030", 4, shade(top, 0.4)) +
        bead(528, 930, 6, tint(top, 0.5)) +
        bead(528, 1000, 6, tint(top, 0.5)) +
        flap(1) +
        flap(-1)
      );
    }
    case "blazer": {
      // The shirt under the jacket contrasts with it, so the lapels read
      const inner = luminance(top) > 0.45 ? "#2a2627" : "#f4f1ec";
      const innerShirt = celShape(context, "inner", smoothClosedPath(torsoPoints(NECKLINES.crew), 0.7), inner, shade(inner, 0.12), [-18, 8]);
      const panel = (side: 1 | -1) => {
        const points: Point[] = [[124, 1070], [152, 950], [200, 884], [280, 838], [372, 806], [432, 794], [462, 884], [490, 984], [500, 1110], [300, 1110]];
        const d = smoothClosedPath(side === 1 ? points : points.map((p) => mirrorX(p)).reverse(), 0.5);
        const lapel = side === 1 ? "M432 800 L468 902 L444 916 L494 1010" : "M592 800 L556 902 L580 916 L530 1010";
        return celShape(context, `jacket${side}`, d, top, context.palette.topShade, [-18, 8]) + strokePath(lapel, DETAIL);
      };
      return innerShirt + panel(1) + panel(-1) + bead(496, 1000, 7, shade(top, 0.25));
    }
    case "tank": {
      const d = smoothClosedPath(
        [[196, 1070], [236, 960], [330, 912], [376, 822], [410, 818], [432, 900], [512, 934], [592, 900], [614, 818], [648, 822], [694, 912], [788, 960], [828, 1070], [512, 1110]],
        0.6,
      );
      return celShape(context, "top", d, top, topShade, [-18, 8]);
    }
  }
};

const necklace: Layer = (context) => {
  const { metal } = context.palette;
  const chain = "M456 786 C470 866 554 866 568 786";
  switch (context.config.necklace) {
    case "none":
      return "";
    case "chain":
      return ring(chain, metal, 4);
    case "pendant":
      return ring(chain, metal, 4) + bead(512, 862, 14, metal);
    case "star": {
      const star = Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
        const radius = index % 2 === 0 ? 20 : 9;
        return `${(512 + Math.cos(angle) * radius).toFixed(1)} ${(866 + Math.sin(angle) * radius).toFixed(1)}`;
      });
      return ring(chain, metal, 4) + `<path d="M${star.join(" L")}Z" fill="${metal}" stroke="${INK}" stroke-width="3"/>`;
    }
    case "pearls":
      return Array.from({ length: 11 }, (_, index) => {
        const t = index / 10;
        const u = 1 - t;
        const x = u * u * u * 448 + 3 * u * u * t * 462 + 3 * u * t * t * 562 + t * t * t * 576;
        const y = u * u * u * 792 + 3 * u * u * t * 874 + 3 * u * t * t * 874 + t * t * t * 792;
        return bead(Math.round(x), Math.round(y), 8, "#f6f1e8");
      }).join("");
    case "choker":
      return (
        fillPath("M458 734 C482 750 542 750 566 734 L568 756 C544 774 480 774 456 756Z", "#2a2426", ` stroke="${INK}" stroke-width="3"`) +
        bead(512, 774, 7, metal)
      );
  }
};

const headphones: Layer = (context) => {
  if (!context.config.extras.includes("headphones")) return "";
  const cup = (x: number) =>
    `<ellipse cx="${x}" cy="812" rx="40" ry="50" fill="#2a2627" stroke="${INK}" stroke-width="${OUTLINE}"/>` +
    `<ellipse cx="${x}" cy="812" rx="22" ry="30" fill="${context.palette.metal}" stroke="${INK}" stroke-width="3"/>`;
  return strokePath("M420 846 C440 900 584 900 604 846", 16) + strokePath("M420 846 C440 900 584 900 604 846", 9, "#3b3638") + cup(416) + cup(608);
};

const hairOver: Layer = (context) => {
  const style = HAIR[context.config.hairStyle];
  const { hair, hairShade } = context.palette;
  const shapes = (style.over ?? [])
    .map((shape, index) =>
      celShape(context, `over${index}`, texturedClosedPath(shape, context.config.hairTexture), hair, hairShade, [-12, -10]),
    )
    .join("");
  return shapes + (style.overArt?.(context) ?? "");
};

const ears: Layer = (context) => {
  const { skin, skinShade, metal } = context.palette;
  const right = EAR_RIGHT.map(([x, y]) => [x + context.earShift, y] as Point);
  const left = right.map((point) => mirrorX(point));
  const lobeY = 580;
  const lobeX = 704 + context.earShift;

  const ear = (points: Point[], side: 1 | -1) => {
    const d = smoothClosedPath(points);
    const x = (value: number) => (side === 1 ? value + context.earShift : CX * 2 - value - context.earShift);
    return fillPath(d, skin) + strokePath(d) + strokePath(`M${x(700)} 492 C${x(722)} 510 ${x(716)} 540 ${x(700)} 552`, DETAIL, skinShade);
  };

  let art = ear(right, 1) + ear(left, -1);

  const both = (draw: (x: number) => string) => draw(lobeX) + draw(CX * 2 - lobeX);
  switch (context.config.earrings) {
    case "stud":
      art += both((x) => bead(x, lobeY, 7, metal));
      break;
    case "smallHoop":
      art += both((x) => ring(`M${x - 13} ${lobeY + 10} A14 14 0 1 0 ${x + 1} ${lobeY - 3}`, metal, 5));
      break;
    case "bigHoop":
      art += both((x) => ring(`M${x - 28} ${lobeY + 26} A30 30 0 1 0 ${x + 1} ${lobeY - 3}`, metal, 6));
      break;
    case "drop":
      art += both(
        (x) =>
          strokePath(`M${x} ${lobeY} L${x} ${lobeY + 26}`, 4, INK) +
          fillPath(`M${x} ${lobeY + 22} C${x + 16} ${lobeY + 44} ${x + 12} ${lobeY + 62} ${x} ${lobeY + 62} C${x - 12} ${lobeY + 62} ${x - 16} ${lobeY + 44} ${x} ${lobeY + 22}Z`, metal, ` stroke="${INK}" stroke-width="3"`),
      );
      break;
    case "pearl":
      art += both((x) => bead(x, lobeY + 6, 11, "#f6f1e8"));
      break;
    case "none":
      break;
  }

  if (context.config.piercing === "helix") {
    const rim = 734 + context.earShift;
    art += both((x) => {
      const offset = x > CX ? rim - lobeX : -(rim - lobeX);
      return ring(`M${x + offset - 10} 494 A9 9 0 1 0 ${x + offset + 4} 486`, metal, 4) + ring(`M${x + offset - 8} 522 A9 9 0 1 0 ${x + offset + 6} 514`, metal, 4);
    });
  }
  return art;
};

const head: Layer = (context) => {
  const { skin, skinShade } = context.palette;
  return celShape(context, "face", context.face.path, skin, skinShade, [-14, -6]);
};

const skinMarks: Layer = (context) => {
  const { config, palette } = context;
  let art = "";

  if (config.extras.includes("blush")) {
    art += `<ellipse cx="424" cy="598" rx="34" ry="18" fill="#e8707e" opacity="0.28"/>`;
    art += `<ellipse cx="600" cy="598" rx="34" ry="18" fill="#e8707e" opacity="0.28"/>`;
  }

  if (config.freckles !== "none") {
    const random = seeded(7);
    const count = config.freckles === "light" ? 14 : 30;
    const color = luminance(palette.skin) > 0.15 ? shade(palette.skin, 0.38) : tint(palette.skin, 0.22);
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? 1 : -1;
      const dx = 30 + random() * 96;
      const x = CX + side * dx;
      const y = 548 + random() * 64 - dx * 0.08;
      const r = 3 + random() * 1.8;
      art += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.75"/>`;
    }
  }

  const MOLE: Record<Exclude<AvatarConfig["mole"], "none">, Point> = {
    cheek: [606, 612],
    lip: [548, 624],
    eye: [610, 548],
    chin: [484, 700],
  };
  if (config.mole !== "none") {
    const [x, y] = MOLE[config.mole];
    art += `<circle cx="${x}" cy="${y}" r="5" fill="${mix(palette.skin, "#1f1210", 0.72)}"/>`;
  }
  return art;
};

type EyeShape = { upper: string; end: string; lower: string; iris: number; crease?: string; lid?: string; lidLine?: string };

/** The viewer's right eye, centred on its origin with the outer corner towards +x. */
const EYES: Record<AvatarConfig["eyeShape"], EyeShape> = {
  almond: { upper: "M-40 6 C-26 -24 18 -30 42 -2", end: "42 -2", lower: "C24 18 -20 22 -40 6", iris: 17, crease: "M-24 -30 C-4 -42 22 -40 34 -26" },
  round: { upper: "M-38 4 C-34 -32 30 -36 40 -2", end: "40 -2", lower: "C36 28 -30 30 -38 4", iris: 19, crease: "M-26 -36 C-6 -48 24 -46 36 -30" },
  monolid: { upper: "M-42 2 C-24 -16 20 -20 42 -4", end: "42 -4", lower: "C24 14 -22 16 -42 2", iris: 15 },
  downturned: { upper: "M-40 -4 C-24 -30 22 -28 42 8", end: "42 8", lower: "C22 20 -22 18 -40 -4", iris: 17, crease: "M-24 -32 C-2 -42 26 -34 38 -16" },
  upturned: { upper: "M-40 8 C-24 -22 18 -34 42 -10", end: "42 -10", lower: "C24 16 -20 22 -40 8", iris: 17, crease: "M-22 -28 C0 -44 24 -46 36 -34" },
  sleepy: {
    upper: "M-40 6 C-26 -24 18 -30 42 -2",
    end: "42 -2",
    lower: "C24 18 -20 22 -40 6",
    iris: 17,
    lid: "M-44 8 C-28 -30 20 -36 46 -2 C20 -2 -20 0 -44 8Z",
    lidLine: "M-40 7 C-16 -1 20 -3 42 -1",
  },
};

/** Slightly large eyes carry the expression; this is the one exaggeration in the style. */
const EYE_SCALE = 1.22;

const eyes: Layer = (context) => {
  const { palette, config } = context;
  const shape = EYES[config.eyeShape];
  const outline = `${shape.upper} ${shape.lower}Z`;

  const eye = (cx: number, side: 1 | -1) => {
    const id = side === 1 ? "eye-r" : "eye-l";
    // Light comes from the upper left, so both highlights sit on the same side on screen
    const highlight = -5 * side;
    return [
      `<g transform="translate(${cx} 500) scale(${side * EYE_SCALE} ${EYE_SCALE})">`,
      `<clipPath id="${id}"><path d="${outline}"/></clipPath>`,
      fillPath(outline, "#fffaf4"),
      `<g clip-path="url(#${id})">`,
      `<circle cx="2" cy="0" r="${shape.iris}" fill="${palette.eye}" stroke="${shade(palette.eye, 0.45)}" stroke-width="3"/>`,
      `<circle cx="2" cy="0" r="${Math.round(shape.iris * 0.46)}" fill="#1a1214"/>`,
      `<circle cx="${highlight}" cy="-7" r="5" fill="#ffffff"/>`,
      `<circle cx="${-highlight + 4}" cy="6" r="2.2" fill="#ffffff" opacity="0.8"/>`,
      "</g>",
      shape.lid ? fillPath(shape.lid, palette.skin) + strokePath(shape.lidLine!, 6) : "",
      shape.crease ? strokePath(shape.crease, 3, palette.skinShade) : "",
      strokePath(shape.upper, 8),
      strokePath(`M${shape.end} L${shape.end.split(" ").map((v, i) => Number(v) + (i === 0 ? 11 : -9)).join(" ")}`, 6),
      strokePath(`M${shape.end} ${shape.lower}`, 3, INK, ` opacity="0.45"`),
      "</g>",
    ].join("");
  };
  return eye(584, 1) + eye(440, -1);
};

const BROWS: Record<AvatarConfig["eyebrows"], string> = {
  natural: "M-46 12 C-24 -8 18 -14 48 0 L46 7 C18 -3 -22 3 -44 20Z",
  thick: "M-48 12 C-26 -12 20 -18 50 -2 L48 11 C18 3 -22 9 -46 27Z",
  thin: "M-44 10 C-22 -6 18 -10 46 2 L45 5 C18 -4 -20 0 -44 14Z",
  arched: "M-46 16 C-28 -16 14 -24 48 6 L45 12 C14 -12 -24 -6 -44 23Z",
  straight: "M-48 4 C-20 -4 20 -4 48 0 L48 9 C20 5 -20 6 -48 15Z",
  bushy: "M-50 14 C-28 -16 22 -22 52 -2 L50 13 C20 5 -24 11 -48 31Z",
};

const brows: Layer = (context) => {
  const { palette, config } = context;
  const d = BROWS[config.eyebrows];
  const brow = (cx: number, side: 1 | -1) => {
    let art = `<g transform="translate(${cx} 432) scale(${side} 1)">${fillPath(d, palette.brow)}`;
    if (config.eyebrows === "bushy") {
      art += strokePath("M-30 2 L-24 -10 M-8 -4 L-2 -16 M14 -6 L20 -17 M34 -4 L40 -13", 4, palette.brow);
    }
    if (config.piercing === "eyebrow" && side === 1) {
      art += strokePath("M40 -14 L44 20", 3, INK) + bead(40, -14, 5, palette.metal) + bead(44, 20, 5, palette.metal);
    }
    return `${art}</g>`;
  };
  return brow(584, 1) + brow(440, -1);
};

const NOSES: Record<AvatarConfig["nose"], string> = {
  button: "M522 540 C534 566 542 584 530 594 C522 600 504 600 494 592",
  straight: "M522 470 C520 520 530 560 540 580 C546 592 532 600 514 598 M490 590 C496 596 502 597 506 595",
  wide: "M524 516 C528 556 556 572 550 592 C544 604 524 602 512 598 M478 578 C466 592 480 604 500 600",
  pointed: "M520 476 C524 526 546 570 554 590 C540 598 524 598 510 596",
  aquiline: "M520 468 C534 498 540 530 538 558 C548 584 544 598 516 598 M492 592 C498 597 504 598 508 596",
  small: "M528 566 C540 582 530 594 512 594 M494 588 C498 593 504 594 508 593",
};

const nose: Layer = (context) => {
  const { palette, config } = context;
  let art =
    fillPath("M540 578 C550 590 542 602 518 602 C532 596 538 590 540 578Z", palette.skinShade) +
    strokePath(NOSES[config.nose], 6);

  switch (config.piercing) {
    case "noseStud":
      art += bead(548, 588, 5, palette.metal);
      break;
    case "noseRing":
      art += ring("M536 596 A12 12 0 1 0 552 586", palette.metal, 4);
      break;
    case "septum":
      art += ring("M500 600 C500 620 524 620 524 600", palette.metal, 4);
      break;
    default:
      break;
  }
  return art;
};

/** The chin-strap band of a beard, derived from the face so it always fits the jaw. */
function beardBand(context: Context, full: boolean): ShapePoint[] {
  const startY = full ? 500 : 548;
  const push = full ? 12 : 6;
  const right = context.face.right
    .filter(([, y]) => y >= startY)
    .map(([x, y]) => {
      const drop = full && y > 640 ? ((y - 640) / 80) * 46 : 0;
      return [x + (x > CX ? push : 0), y + drop + (x === CX ? push : 0)] as Point;
    });
  const outer = [...right.slice(0, -1), ...right.slice().reverse().map((point) => mirrorX(point))];
  // Back up across the face under the mouth, smooth, so the lips stay visible
  const inner: Point[] = [[CX * 2 - right[0]![0] + 34, startY + 20], [446, 618], [470, 690], [512, 698], [554, 690], [578, 618], [right[0]![0] - 34, startY + 20]];
  return [
    ...outer.map((p) => [p[0], p[1], true] as const),
    ...inner.map((p) => [p[0], p[1], false] as const),
  ];
}

const MUSTACHE = smoothClosedPath(symmetric([[512, 614], [548, 608], [582, 626], [590, 650], [556, 640], [512, 636]]), 0.8);

const facialHair: Layer = (context) => {
  const { config, palette } = context;
  const color = palette.hair;
  const band = (full: boolean) => texturedClosedPath(beardBand(context, full), config.hairTexture, 0.55);
  const solid = (d: string) => fillPath(d, color) + strokePath(d);

  switch (config.facialHair) {
    case "none":
      return "";
    case "stubble":
      return fillPath(band(false), color, ` opacity="0.2"`) + fillPath(MUSTACHE, color, ` opacity="0.2"`);
    case "mustache":
      return solid(MUSTACHE);
    case "goatee": {
      const chin = smoothClosedPath(symmetric([[512, 676], [538, 680], [552, 704], [540, 734], [512, 746]]), 0.9);
      return solid(chin) + solid(MUSTACHE);
    }
    case "shortBeard":
      return solid(band(false)) + solid(MUSTACHE);
    case "fullBeard":
      return solid(band(true)) + solid(MUSTACHE);
  }
};

const mouth: Layer = (context) => {
  const { palette, config } = context;
  const interior = "#5b2230";
  let art = "";
  switch (config.mouth) {
    case "smile":
      art =
        fillPath("M472 642 C494 662 530 662 552 642 C536 676 488 676 472 642Z", palette.lip) +
        strokePath("M466 640 C492 666 532 666 558 640") +
        strokePath("M462 634 L470 644 M562 634 L554 644", 5);
      break;
    case "neutral":
      art =
        fillPath("M486 654 C500 670 524 670 538 654Z", palette.lip) +
        strokePath("M476 650 C498 656 526 656 548 648") +
        strokePath("M494 670 C506 674 518 674 530 670", 4, INK, ` opacity="0.4"`);
      break;
    case "grin": {
      const outline = "M460 634 C480 632 544 632 564 634 C554 690 470 690 460 634Z";
      art =
        fillPath(outline, interior) +
        fillPath("M468 638 C490 642 534 642 556 638 C554 654 470 654 468 638Z", "#fffaf2") +
        fillPath("M490 674 C502 664 522 664 534 674 C524 684 500 684 490 674Z", "#d9687a") +
        strokePath(outline);
      break;
    }
    case "full": {
      const upper = "M472 648 C486 632 500 630 512 640 C524 630 538 632 552 648 C530 654 494 654 472 648Z";
      const lower = "M472 648 C494 654 530 654 552 648 C542 680 482 680 472 648Z";
      art =
        fillPath(lower, palette.lip) +
        fillPath(upper, shade(palette.lip, 0.15)) +
        fillPath("M494 660 C504 656 516 656 526 660", tint(palette.lip, 0.35), ` opacity="0.7"`) +
        strokePath(upper, DETAIL) +
        strokePath(lower, DETAIL) +
        strokePath("M472 648 C494 654 530 654 552 648", 6);
      break;
    }
    case "smirk":
      art =
        fillPath("M480 654 C502 668 530 660 552 640 C540 672 500 678 480 654Z", palette.lip) +
        strokePath("M474 652 C500 662 532 654 558 632") +
        strokePath("M558 632 C566 630 570 636 566 644", 4);
      break;
    case "laugh": {
      const outline = "M462 630 C496 640 528 640 562 630 C558 694 466 694 462 630Z";
      art =
        fillPath(outline, interior) +
        fillPath("M468 634 C496 642 528 642 556 634 C552 648 472 648 468 634Z", "#fffaf2") +
        fillPath("M484 676 C498 662 526 662 540 676 C526 690 498 690 484 676Z", "#d9687a") +
        strokePath(outline);
      break;
    }
  }
  if (config.piercing === "lipRing") art += ring("M530 668 A11 11 0 1 0 546 670", palette.metal, 4);
  return art;
};

const bandage: Layer = (context) => {
  if (!context.config.extras.includes("bandage")) return "";
  return (
    `<g transform="translate(600 612) rotate(-24)">` +
    `<rect x="-34" y="-12" width="68" height="24" rx="10" fill="#efcfa9" stroke="${INK}" stroke-width="${DETAIL}"/>` +
    `<rect x="-12" y="-9" width="24" height="18" rx="4" fill="#e2b98c"/>` +
    `<circle cx="-5" cy="-3" r="1.8" fill="${INK}" opacity="0.4"/><circle cx="5" cy="3" r="1.8" fill="${INK}" opacity="0.4"/>` +
    "</g>"
  );
};

const hairFront: Layer = (context) => {
  const style = HAIR[context.config.hairStyle];
  if (!style.front) return "";
  const { hair, hairShade, hairStrand } = context.palette;
  const buzz = context.config.hairStyle === "buzz";
  // Hair this short has no texture to show on its edge
  const texture = buzz ? "straight" : context.config.hairTexture;
  const d = texturedClosedPath(style.front, texture);
  const hairline = style.front.filter((point) => point[2] === false).map((point) => [point[0], point[1]] as Point);

  context.defs.push(`<clipPath id="hair-front"><path d="${d}"/></clipPath>`);
  return [
    fillPath(d, hairShade, buzz ? ` opacity="0.9"` : ""),
    `<g clip-path="url(#hair-front)"><path d="${d}" fill="${hair}" transform="translate(4 -18)"${buzz ? ` opacity="0.9"` : ""}/></g>`,
    style.strands && !buzz
      ? `<path d="${textureStrands(style.strands, texture)}" fill="none" stroke="${hairStrand}" stroke-width="4" clip-path="url(#hair-front)"/>`
      : "",
    style.blend ? strokePath(smoothOpenPath(hairline)) : strokePath(d),
  ].join("");
};

type Frame = { d: string; width: number; tinted?: boolean; inner: number; outer: number };

const FRAMES: Record<Exclude<AvatarConfig["glasses"], "none">, Frame> = {
  round: { d: "M-50 0 A50 50 0 1 0 50 0 A50 50 0 1 0 -50 0Z", width: 8, inner: 50, outer: 50 },
  rectangle: { d: "M-44 -38 L44 -38 Q58 -38 58 -24 L58 22 Q58 38 42 38 L-42 38 Q-58 38 -58 22 L-58 -24 Q-58 -38 -44 -38Z", width: 8, inner: 58, outer: 58 },
  catEye: { d: "M-56 -18 C-52 -44 40 -46 64 -44 C62 8 40 38 0 38 C-40 38 -58 12 -56 -18Z", width: 8, inner: 56, outer: 64 },
  oversized: { d: "M-40 -54 L40 -54 Q66 -54 66 -28 L66 22 Q66 50 38 50 L-38 50 Q-66 50 -66 22 L-66 -28 Q-66 -54 -40 -54Z", width: 9, inner: 66, outer: 66 },
  wire: { d: "M-48 0 A48 42 0 1 0 48 0 A48 42 0 1 0 -48 0Z", width: 4, inner: 48, outer: 48 },
  sunglasses: { d: "M-54 -32 L54 -32 Q62 -32 60 -18 C56 24 34 42 0 42 C-34 42 -56 24 -60 -18 Q-62 -32 -54 -32Z", width: 8, tinted: true, inner: 60, outer: 60 },
};

const glasses: Layer = (context) => {
  const { config, palette } = context;
  if (config.glasses === "none") return "";
  const frame = FRAMES[config.glasses];
  const color = palette.glasses;

  const lens = (cx: number, side: 1 | -1) =>
    `<g transform="translate(${cx} 500) scale(${side} 1)">` +
    (frame.tinted
      ? fillPath(frame.d, "#2a2226", ` opacity="0.9"`) + strokePath("M-30 -14 L-8 -24", 6, "#ffffff", ` opacity="0.55"`)
      : fillPath(frame.d, "#ffffff", ` opacity="0.16"`) + strokePath("M-28 -16 L-10 -26", 4, "#ffffff", ` opacity="0.7"`)) +
    (frame.width > 5 ? strokePath(frame.d, frame.width + 4, INK) : "") +
    strokePath(frame.d, frame.width, color) +
    "</g>";

  const bridge = `M${440 + frame.inner} 494 Q512 474 ${584 - frame.inner} 494`;
  const temple = (side: 1 | -1) =>
    side === 1
      ? `M${584 + frame.outer} 490 L${680 + context.earShift} 482`
      : `M${440 - frame.outer} 490 L${344 - context.earShift} 482`;
  const line = (d: string) => (frame.width > 5 ? strokePath(d, frame.width + 2, INK) : "") + strokePath(d, Math.max(3, frame.width - 2), color);

  return line(temple(1)) + line(temple(-1)) + line(bridge) + lens(584, 1) + lens(440, -1);
};

const headwear: Layer = (context) => {
  const { config, palette } = context;
  let art = "";
  if (config.extras.includes("beret")) {
    const beret = "M306 322 C286 250 392 166 540 166 C672 166 752 226 732 292 C712 322 640 300 512 302 C400 304 336 336 306 322Z";
    art += celShape(context, "beret", beret, palette.top, palette.topShade, [-12, -12]);
    art += strokePath("M540 166 C534 146 550 136 562 146", 8);
  }
  if (config.extras.includes("hairClip")) {
    art +=
      `<g transform="translate(628 346) rotate(-28)">` +
      `<rect x="-34" y="-9" width="68" height="18" rx="9" fill="${palette.metal}" stroke="${INK}" stroke-width="${DETAIL}"/>` +
      `<circle cx="-20" cy="0" r="3" fill="#ffffff" opacity="0.7"/></g>`;
  }
  if (config.extras.includes("flower")) {
    const petals = Array.from({ length: 5 }, (_, index) => {
      const angle = (index / 5) * Math.PI * 2;
      return `<circle cx="${(388 + Math.cos(angle) * 18).toFixed(1)}" cy="${(328 + Math.sin(angle) * 18).toFixed(1)}" r="15" fill="#f4f1ec" stroke="${INK}" stroke-width="4"/>`;
    }).join("");
    art += petals + `<circle cx="388" cy="328" r="10" fill="#e3b23c" stroke="${INK}" stroke-width="4"/>`;
  }
  if (config.extras.includes("pencil")) {
    art +=
      `<g transform="translate(${716 + context.earShift} 452) rotate(-62)">` +
      `<rect x="-74" y="-10" width="120" height="20" fill="#f2c14e" stroke="${INK}" stroke-width="${DETAIL}"/>` +
      `<rect x="-92" y="-10" width="20" height="20" rx="4" fill="#e58fb0" stroke="${INK}" stroke-width="${DETAIL}"/>` +
      `<path d="M46 -10 L78 0 L46 10Z" fill="#ecd3ac" stroke="${INK}" stroke-width="${DETAIL}"/>` +
      `<path d="M68 -3 L78 0 L68 3Z" fill="${INK}"/>` +
      "</g>";
  }
  return art;
};

/** The drawing order. A new part is a new layer here, nothing else changes. */
export const AVATAR_LAYERS: readonly { name: string; draw: Layer }[] = [
  { name: "hairBack", draw: hairBack },
  { name: "torso", draw: torso },
  { name: "neck", draw: neck },
  { name: "clothing", draw: clothing },
  { name: "necklace", draw: necklace },
  { name: "headphones", draw: headphones },
  { name: "hairOver", draw: hairOver },
  { name: "ears", draw: ears },
  { name: "head", draw: head },
  { name: "skinMarks", draw: skinMarks },
  { name: "eyes", draw: eyes },
  { name: "brows", draw: brows },
  { name: "nose", draw: nose },
  { name: "facialHair", draw: facialHair },
  { name: "mouth", draw: mouth },
  { name: "bandage", draw: bandage },
  { name: "hairFront", draw: hairFront },
  { name: "glasses", draw: glasses },
  { name: "headwear", draw: headwear },
];

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function paletteFor(config: AvatarConfig): Palette {
  const skin = hexOf(SKIN_TONES, config.skinTone);
  const hair = hexOf(HAIR_COLORS, config.hairColor);
  const top = hexOf(TOP_COLORS, config.topColor);
  const lipHex = hexOf(LIP_COLORS, config.lipColor);
  const hairLight = luminance(hair);
  return {
    skin,
    skinShade: shade(skin, 0.2),
    hair,
    hairShade: shade(hair, 0.28),
    // Strands must show on black hair as much as on platinum
    hairStrand: hairLight < 0.06 ? tint(hair, 0.22) : shade(hair, 0.32),
    brow: hairLight > 0.35 ? shade(hair, 0.5) : shade(hair, 0.12),
    eye: hexOf(EYE_COLORS, config.eyeColor),
    lip: lipHex === "" ? mix(shade(skin, 0.12), "#c2566a", 0.3) : lipHex,
    top,
    topShade: shade(top, 0.2),
    glasses: hexOf(GLASSES_COLORS, config.glassesColor),
    metal: hexOf(JEWELRY_COLORS, config.jewelryColor),
  };
}

export type RenderOptions = {
  /** Crops the drawing, e.g. to the eyes for an option thumbnail. */
  viewBox?: string;
  /** Output size in pixels; the drawing itself is resolution independent. */
  size?: number;
};

export function renderAvatarSvg(config: AvatarConfig, options: RenderOptions = {}): string {
  const right = FACE_RIGHT[config.faceShape];
  const context: Context = {
    config,
    palette: paletteFor(config),
    defs: [],
    face: { path: smoothClosedPath(symmetric(right)), right },
    // Ears sit against the widest point of the face
    earShift: right[4]![0] - 686,
  };

  const body = AVATAR_LAYERS.map((layer) => `<g data-layer="${layer.name}">${layer.draw(context)}</g>`).join("");
  const size = options.size ?? AVATAR_CANVAS;
  const viewBox = options.viewBox ?? `0 0 ${AVATAR_CANVAS} ${AVATAR_CANVAS}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}">` +
    `<defs>${context.defs.join("")}</defs>` +
    `<g stroke-linecap="round" stroke-linejoin="round">${body}</g>` +
    "</svg>"
  );
}

/** The SVG as a data URI, for an `<img>` (the CSP allows `data:` images). */
export function avatarDataUri(config: AvatarConfig, options: RenderOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderAvatarSvg(config, options))}`;
}
