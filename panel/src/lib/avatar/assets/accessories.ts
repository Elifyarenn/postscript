/**
 * Glasses, earrings, piercings, necklaces and extras (D-195).
 *
 * Piercings and extras are sets: several can be worn at once (the reference
 * shows a hoop, a helix and an industrial bar on one ear). Everything worn on
 * the head is in head space; necklaces and the headphones sit on the body.
 */
import { CX, INK, bead, cel, fill, inHead, ring, stroke, type DrawContext } from "../canvas";
import { mix, shade } from "../geometry";
import { earPoints } from "./face";
import { coversEars } from "./headscarf";
import { EYE_LEFT_X, EYE_RIGHT_X, EYE_SCALE, EYE_Y, FACE_ANCHORS } from "./features";
import { NONE, type Asset, type ColorOption } from "./types";

export const GLASSES_COLORS = [
  { id: "black", label: "Siyah", hex: "#1f1b1c" },
  { id: "tortoise", label: "Kaplumbağa", hex: "#7a4b2a" },
  { id: "gold", label: "Altın", hex: "#c9a24a" },
  { id: "silver", label: "Gümüş", hex: "#a9adb3" },
  { id: "burgundy", label: "Bordo", hex: "#6f1d2c" },
  { id: "clear", label: "Şeffaf", hex: "#cfc6ba" },
] as const satisfies readonly ColorOption[];

/**
 * Hats have a colour of their own (D-224). They used to take the clothing
 * colour, which made every hat match the top whether or not that was wanted.
 */
export const HEADWEAR_COLORS = [
  { id: "black", label: "Siyah", hex: "#26222a" },
  { id: "charcoal", label: "Antrasit", hex: "#45444a" },
  { id: "gray", label: "Gri", hex: "#8e8d93" },
  { id: "cream", label: "Krem", hex: "#efe3cf" },
  { id: "white", label: "Beyaz", hex: "#f2f0ec" },
  { id: "sand", label: "Bej", hex: "#d8c3a3" },
  { id: "camel", label: "Camel", hex: "#bf9563" },
  { id: "brown", label: "Kahve", hex: "#7a5741" },
  { id: "burgundy", label: "Bordo", hex: "#75263a" },
  { id: "red", label: "Kırmızı", hex: "#b8463c" },
  { id: "rose", label: "Gül kurusu", hex: "#c08492" },
  { id: "plum", label: "Mürdüm", hex: "#5c3a63" },
  { id: "navy", label: "Lacivert", hex: "#2f3f63" },
  { id: "blue", label: "Mavi", hex: "#5b7fb4" },
  { id: "teal", label: "Petrol", hex: "#3a7d80" },
  { id: "emerald", label: "Zümrüt", hex: "#3d7a5c" },
  { id: "olive", label: "Haki", hex: "#6f7346" },
  { id: "mustard", label: "Hardal", hex: "#c39a3c" },
] as const satisfies readonly ColorOption[];

export const JEWELRY_COLORS = [
  { id: "silver", label: "Gümüş", hex: "#c3c7cc" },
  { id: "gold", label: "Altın", hex: "#d4a73a" },
  { id: "roseGold", label: "Rose gold", hex: "#d59a82" },
  { id: "black", label: "Siyah", hex: "#2b2b2b" },
] as const satisfies readonly ColorOption[];

/* ------------------------------------------------------------------ */
/* Glasses                                                             */
/* ------------------------------------------------------------------ */

type Frame = { d: string; width: number; inner: number; outer: number; tinted?: boolean; lens?: string };

function glasses(id: string, label: string, frame: Frame): Asset {
  return {
    id,
    label,
    layers: {
      glasses: (context) => {
        const color = context.palette.glasses;
        const lensArt = (cx: number, side: 1 | -1) =>
          `<g transform="translate(${cx} ${EYE_Y}) scale(${side * EYE_SCALE} ${EYE_SCALE})">` +
          (frame.tinted
            ? fill(frame.lens ?? frame.d, "#231c20", ` opacity="0.9"`) + stroke("M-40 -18 L-14 -32", 7, "#ffffff", ` opacity="0.45"`)
            : fill(frame.lens ?? frame.d, "#ffffff", ` opacity="0.14"`) + stroke("M-40 -22 L-18 -36", 5, "#ffffff", ` opacity="0.7"`)) +
          (frame.width > 4 ? stroke(frame.d, frame.width + 3, INK) : "") +
          stroke(frame.d, frame.width, color) +
          "</g>";
        const line = (d: string) => (frame.width > 4 ? stroke(d, frame.width + 1, INK) : "") + stroke(d, Math.max(3, frame.width - 2), color);
        // Frames grow with the eyes; the bridge and temples start where the lenses end
        const inner = frame.inner * EYE_SCALE;
        const outer = frame.outer * EYE_SCALE;
        const bridge = `M${EYE_LEFT_X + inner} 548 Q${CX} 526 ${EYE_RIGHT_X - inner} 548`;
        const temples = `M${EYE_RIGHT_X + outer} 540 L${740 + context.earShift} 530 M${EYE_LEFT_X - outer} 540 L${284 - context.earShift} 530`;
        return inHead(line(temples) + line(bridge) + lensArt(EYE_RIGHT_X, 1) + lensArt(EYE_LEFT_X, -1));
      },
    },
  };
}

export const GLASSES = [
  NONE,
  glasses("round", "Yuvarlak", { d: "M-70 0 A70 70 0 1 0 70 0 A70 70 0 1 0 -70 0Z", width: 6, inner: 70, outer: 70 }),
  glasses("square", "Kare", { d: "M-60 -52 L60 -52 Q78 -52 78 -34 L78 32 Q78 52 58 52 L-58 52 Q-78 52 -78 32 L-78 -34 Q-78 -52 -60 -52Z", width: 6, inner: 78, outer: 78 }),
  glasses("catEye", "Kedi göz", { d: "M-74 -20 C-70 -56 56 -62 90 -60 C86 12 56 50 0 50 C-56 50 -76 16 -74 -20Z", width: 6, inner: 74, outer: 90 }),
  glasses("bigRound", "Büyük yuvarlak", { d: "M-82 0 A82 80 0 1 0 82 0 A82 80 0 1 0 -82 0Z", width: 7, inner: 82, outer: 82 }),
  glasses("halfRim", "Yarım çerçeve", {
    d: "M-78 -30 C-40 -52 40 -54 82 -32",
    lens: "M-78 -30 C-40 -52 40 -54 82 -32 C84 20 44 50 0 50 C-44 50 -82 20 -78 -30Z",
    width: 9,
    inner: 78,
    outer: 82,
  }),
  glasses("wire", "İnce tel", { d: "M-66 0 A66 58 0 1 0 66 0 A66 58 0 1 0 -66 0Z", width: 3, inner: 66, outer: 66 }),
  glasses("sunglasses", "Güneş gözlüğü", { d: "M-72 -44 L72 -44 Q84 -44 82 -28 C78 26 50 52 0 52 C-50 52 -78 26 -82 -28 Q-84 -44 -72 -44Z", width: 6, inner: 82, outer: 82, tinted: true }),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Earrings (both lobes)                                               */
/* ------------------------------------------------------------------ */

function earring(id: string, label: string, art: (context: DrawContext, x: number, y: number) => string): Asset {
  return {
    id,
    label,
    layers: {
      earrings: (context) => {
        if (coversEars(context)) return "";
        const [x, y] = earPoints(context).lobe;
        return inHead(art(context, x, y) + art(context, CX * 2 - x, y));
      },
    },
  };
}

const star = (cx: number, cy: number, outer: number, inner: number) =>
  `M${Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
    const radius = index % 2 === 0 ? outer : inner;
    return `${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" L")}Z`;

export const EARRINGS = [
  NONE,
  earring("stud", "Küçük taş", (c, x, y) => bead(x, y, 7, c.palette.metal)),
  earring("smallHoop", "Küçük halka", (c, x, y) => ring(`M${x - 13} ${y + 8} A15 15 0 1 0 ${x + 1} ${y - 4}`, c.palette.metal, 4.5)),
  earring("bigHoop", "Büyük halka", (c, x, y) => ring(`M${x - 28} ${y + 24} A30 30 0 1 0 ${x + 1} ${y - 4}`, c.palette.metal, 5)),
  earring("drop", "Sallantılı", (c, x, y) =>
    stroke(`M${x} ${y} L${x} ${y + 26}`, 3.5) +
    fill(`M${x} ${y + 22} C${x + 15} ${y + 42} ${x + 11} ${y + 60} ${x} ${y + 60} C${x - 11} ${y + 60} ${x - 15} ${y + 42} ${x} ${y + 22}Z`, c.palette.metal, ` stroke="${INK}" stroke-width="3"`),
  ),
  earring("pearl", "İnci", (_c, x, y) => bead(x, y + 6, 11, "#f6f1e8")),
  earring("star", "Yıldız", (c, x, y) => stroke(`M${x} ${y} L${x} ${y + 18}`, 3) + fill(star(x, y + 34, 16, 7), c.palette.metal, ` stroke="${INK}" stroke-width="2.5"`)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Piercings (a set)                                                   */
/* ------------------------------------------------------------------ */

function piercing(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { piercings: (context) => inHead(art(context)) } };
}

export const PIERCINGS = [
  piercing("helix", "Helix", (c) => {
    if (coversEars(c)) return "";
    const [x, y] = earPoints(c).rim;
    return ring(`M${x - 10} ${y - 12} A10 10 0 1 0 ${x + 4} ${y - 18}`, c.palette.metal, 4) + ring(`M${x - 6} ${y + 16} A10 10 0 1 0 ${x + 8} ${y + 10}`, c.palette.metal, 4);
  }),
  piercing("industrial", "Industrial", (c) => {
    if (coversEars(c)) return "";
    const [x, y] = earPoints(c).rim;
    return stroke(`M${x - 44} ${y - 36} L${x + 2} ${y + 6}`, 6.5) + stroke(`M${x - 44} ${y - 36} L${x + 2} ${y + 6}`, 3.5, c.palette.metal) + bead(x - 44, y - 36, 5, c.palette.metal) + bead(x + 2, y + 6, 5, c.palette.metal);
  }),
  piercing("lobeStack", "Kulak memesi", (c) => {
    if (coversEars(c)) return "";
    const [x, y] = earPoints(c).lobe;
    return bead(x + 6, y - 22, 5, c.palette.metal) + bead(CX * 2 - x - 6, y - 22, 5, c.palette.metal);
  }),
  piercing("noseStud", "Burun taşı", (c) => bead(FACE_ANCHORS.nostril[0], FACE_ANCHORS.nostril[1], 5, c.palette.metal)),
  piercing("noseRing", "Burun halkası", (c) => ring(`M${FACE_ANCHORS.nostril[0] - 6} ${FACE_ANCHORS.nostril[1] + 2} A11 11 0 1 0 ${FACE_ANCHORS.nostril[0] + 8} ${FACE_ANCHORS.nostril[1] - 8}`, c.palette.metal, 3.5)),
  piercing("septum", "Septum", (c) => ring(`M${FACE_ANCHORS.septum[0] - 11} ${FACE_ANCHORS.septum[1] - 2} C${FACE_ANCHORS.septum[0] - 11} ${FACE_ANCHORS.septum[1] + 16} ${FACE_ANCHORS.septum[0] + 11} ${FACE_ANCHORS.septum[1] + 16} ${FACE_ANCHORS.septum[0] + 11} ${FACE_ANCHORS.septum[1] - 2}`, c.palette.metal, 3.5)),
  piercing("lipRing", "Dudak halkası", (c) => ring(`M${FACE_ANCHORS.lipCorner[0] - 6} ${FACE_ANCHORS.lipCorner[1] - 4} A10 10 0 1 0 ${FACE_ANCHORS.lipCorner[0] + 8} ${FACE_ANCHORS.lipCorner[1]}`, c.palette.metal, 3.5)),
  piercing("eyebrow", "Kaş", (c) => {
    const [x, y] = FACE_ANCHORS.browEnd;
    return stroke(`M${x} ${y} L${x + 6} ${y + 34}`, 3) + bead(x, y, 5, c.palette.metal) + bead(x + 6, y + 34, 5, c.palette.metal);
  }),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Necklaces                                                           */
/* ------------------------------------------------------------------ */

const CHAIN = "M462 770 C476 856 548 856 562 770";

function necklace(id: string, label: string, art: (context: DrawContext) => string): Asset {
  return { id, label, layers: { necklace: art } };
}

export const NECKLACES = [
  NONE,
  necklace("chain", "İnce zincir", (c) => ring(CHAIN, c.palette.metal, 3.5)),
  necklace("pendant", "Madalyon", (c) => ring(CHAIN, c.palette.metal, 3.5) + bead(512, 852, 13, c.palette.metal)),
  necklace("star", "Yıldız uçlu", (c) => ring(CHAIN, c.palette.metal, 3.5) + fill(star(512, 858, 18, 8), c.palette.metal, ` stroke="${INK}" stroke-width="2.5"`)),
  necklace("layered", "Katmanlı", (c) => ring(CHAIN, c.palette.metal, 3) + ring("M448 776 C462 900 562 900 576 776", c.palette.metal, 3) + bead(512, 886, 7, c.palette.metal)),
  necklace("pearls", "İnci", () =>
    Array.from({ length: 11 }, (_, index) => {
      const t = index / 10;
      const u = 1 - t;
      const x = u * u * u * 456 + 3 * u * u * t * 470 + 3 * u * t * t * 554 + t * t * t * 568;
      const y = u * u * u * 772 + 3 * u * u * t * 846 + 3 * u * t * t * 846 + t * t * t * 772;
      return bead(x, y, 7, "#f6f1e8");
    }).join(""),
  ),
  necklace("choker", "Choker", (c) => fill("M474 688 C494 700 530 700 550 688 L552 708 C530 722 494 722 472 708Z", "#2a2426", ` stroke="${INK}" stroke-width="2.5"`) + bead(512, 722, 6, c.palette.metal)),
] as const satisfies readonly Asset[];

/* ------------------------------------------------------------------ */
/* Extras (a set)                                                      */
/* ------------------------------------------------------------------ */

function extra(id: string, label: string, layers: Asset["layers"]): Asset {
  return { id, label, layers };
}

const onHead = (art: (context: DrawContext) => string) => (context: DrawContext) => inHead(art(context));

/** From one cup, up past the side of the neck and round the back of it (D-222). */
const HEADPHONE_BAND = "M424 774 C420 736 456 716 512 716 C568 716 604 736 600 774";

export const EXTRAS = [
  extra("cap", "Şapka", {
    accessories: onHead((c) => {
      const color = c.palette.headwear;
      const crown = "M300 344 C286 206 392 128 512 126 C632 128 738 206 724 344 C650 318 374 318 300 344Z";
      const brim = "M286 344 C360 306 664 306 738 344 C720 388 304 388 286 344Z";
      return cel(c, "cap", crown, color, shade(color, 0.22), [-12, -8]) + stroke("M512 130 L512 322", 3.5, shade(color, 0.3)) + fill(brim, shade(color, 0.15)) + stroke(brim) + bead(512, 130, 8, shade(color, 0.2));
    }),
  }),
  extra("beanie", "Örgü bere", {
    accessories: onHead((c) => {
      const color = c.palette.headwear;
      const dome = "M300 350 C282 190 400 104 512 104 C624 104 742 190 724 350Z";
      const cuff = "M286 318 C400 290 624 290 738 318 L744 384 C624 356 400 356 280 384Z";
      const ribs = [340, 380, 420, 460, 500, 540, 580, 620, 660, 700].map((x) => `M${x} ${322 - Math.abs(x - 512) * 0.05} L${x} ${366 - Math.abs(x - 512) * 0.05}`).join(" ");
      return cel(c, "beanie", dome, color, shade(color, 0.22), [-12, -8]) + fill(cuff, shade(color, 0.1)) + stroke(ribs, 3, shade(color, 0.3)) + stroke(cuff);
    }),
  }),
  extra("beret", "Bere", {
    accessories: onHead((c) => {
      const color = c.palette.headwear;
      const d = "M290 306 C268 222 380 140 540 140 C692 140 772 210 750 282 C726 312 640 292 512 294 C390 296 320 324 290 306Z";
      return cel(c, "beret", d, color, shade(color, 0.22), [-10, -10]) + stroke("M540 142 C534 120 552 110 564 120", 7);
    }),
  }),
  extra("headphones", "Boyunda kulaklık", {
    // Headphones rest around the neck, so the band passes behind it and only
    // the cups hang in front. Drawn before the body, it comes out beside the
    // neck and disappears behind it, instead of crossing the throat (D-222).
    backHair: () => stroke(HEADPHONE_BAND, 15) + stroke(HEADPHONE_BAND, 8, "#3b3638"),
    accessories: () => {
      const cup = (x: number) =>
        `<ellipse cx="${x}" cy="792" rx="36" ry="44" fill="#2a2627" stroke="${INK}" stroke-width="6"/>` +
        `<ellipse cx="${x}" cy="792" rx="20" ry="27" fill="#4a4648" stroke="${INK}" stroke-width="3"/>`;
      return cup(422) + cup(602);
    },
  }),
  extra("hairClip", "Toka", {
    accessories: onHead((c) =>
      `<g transform="translate(646 330) rotate(-30)">` +
      `<rect x="-36" y="-22" width="72" height="14" rx="7" fill="${c.palette.metal}" stroke="${INK}" stroke-width="4"/>` +
      `<rect x="-30" y="4" width="64" height="14" rx="7" fill="${mix(c.palette.metal, "#e58fb0", 0.6)}" stroke="${INK}" stroke-width="4"/></g>`,
    ),
  }),
  extra("flower", "Çiçek", {
    accessories: onHead(() => {
      const petals = Array.from({ length: 5 }, (_, index) => {
        const angle = (index / 5) * Math.PI * 2;
        return `<circle cx="${(372 + Math.cos(angle) * 18).toFixed(1)}" cy="${(326 + Math.sin(angle) * 18).toFixed(1)}" r="15" fill="#f6f1ea" stroke="${INK}" stroke-width="3.5"/>`;
      }).join("");
      return petals + `<circle cx="372" cy="326" r="10" fill="#e3b23c" stroke="${INK}" stroke-width="3.5"/>`;
    }),
  }),
  extra("pencil", "Kulakta kalem", {
    accessories: onHead((c) =>
      `<g transform="translate(${760 + c.earShift} 500) rotate(-62)">` +
      `<rect x="-74" y="-10" width="120" height="20" fill="#f2c14e" stroke="${INK}" stroke-width="4"/>` +
      `<rect x="-92" y="-10" width="20" height="20" rx="4" fill="#e58fb0" stroke="${INK}" stroke-width="4"/>` +
      `<path d="M46 -10 L78 0 L46 10Z" fill="#ecd3ac" stroke="${INK}" stroke-width="4"/><path d="M68 -3 L78 0 L68 3Z" fill="${INK}"/></g>`,
    ),
  }),
  extra("bandage", "Yara bandı", {
    accessories: onHead(() =>
      `<g transform="translate(668 664) rotate(-22)">` +
      `<rect x="-34" y="-12" width="68" height="24" rx="10" fill="#efcfa9" stroke="${INK}" stroke-width="3.5"/>` +
      `<rect x="-12" y="-9" width="24" height="18" rx="4" fill="#e2b98c"/></g>`,
    ),
  }),
  extra("sticker", "Yıldız çıkartma", {
    accessories: onHead(() => fill(star(356, 642, 16, 7), "#f2c14e", ` stroke="${INK}" stroke-width="3"`)),
  }),
] as const satisfies readonly Asset[];

/** Hats cover the top of the hair; the registry uses this to keep random avatars sensible. */
export const HEADWEAR = new Set(["cap", "beanie", "beret"]);

