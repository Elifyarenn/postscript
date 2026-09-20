/**
 * Clothing (D-195), drawn in canvas space over the shoulders and neck.
 * One colour choice tints every piece; details (ribs, seams, buttons) are
 * shades of that colour, so no top ever clashes with itself.
 */
import { INK, bead, cel, fill, ring, stroke, type DrawContext } from "../canvas";
import { luminance, mirrorX, shade, smoothClosedPath, tint, type Point } from "../geometry";
import { torso } from "./face";
import type { Asset, ColorOption } from "./types";

export const CLOTHING_COLORS = [
  { id: "black", label: "Siyah", hex: "#2a2627" },
  { id: "charcoal", label: "Antrasit", hex: "#4a4648" },
  { id: "white", label: "Beyaz", hex: "#f4f1ec" },
  { id: "cream", label: "Krem", hex: "#e8dcc4" },
  { id: "gray", label: "Gri", hex: "#9a979a" },
  { id: "burgundy", label: "Bordo", hex: "#6f1d2c" },
  { id: "navy", label: "Lacivert", hex: "#26324f" },
  { id: "forest", label: "Orman yeşili", hex: "#2f5a45" },
  { id: "olive", label: "Zeytin", hex: "#6b6b3a" },
  { id: "mustard", label: "Hardal", hex: "#d4a23a" },
  { id: "rust", label: "Kiremit", hex: "#b5532f" },
  { id: "pink", label: "Pembe", hex: "#e7a3b5" },
  { id: "lilac", label: "Lila", hex: "#a996c9" },
  { id: "sky", label: "Gök mavisi", hex: "#8fb6d9" },
] as const satisfies readonly ColorOption[];

const NECKLINE: Record<string, Point[]> = {
  crew: [[452, 758], [478, 790], [512, 800], [546, 790], [572, 758]],
  deepCrew: [[446, 760], [476, 800], [512, 812], [548, 800], [578, 760]],
  vneck: [[446, 756], [482, 806], [506, 846], [518, 846], [542, 806], [578, 756]],
  collar: [[460, 760], [488, 796], [508, 826], [516, 826], [536, 796], [564, 760]],
  turtle: [[456, 772], [458, 650], [512, 660], [566, 650], [568, 772]],
};

/** A detail line a little darker (or, on black, lighter) than the fabric. */
function seam(color: string, amount = 0.3): string {
  return luminance(color) < 0.05 ? tint(color, 0.18) : shade(color, amount);
}

function body(context: DrawContext, neckline: keyof typeof NECKLINE, name = "top", color?: string): string {
  const base = color ?? context.palette.clothing;
  return cel(context, name, torso(NECKLINE[neckline]!), base, shade(base, 0.2), [-18, 8]);
}

function band(outer: Point[], inner: Point[], color: string): string {
  const d = smoothClosedPath([...outer, ...inner.slice().reverse()], 0.8);
  return fill(d, color) + stroke(d, 4.5);
}

function clothing(id: string, label: string, layers: Asset["layers"]): Asset {
  return { id, label, layers };
}

export const CLOTHING = [
  clothing("hoodie", "Kapüşonlu", {
    // The hood lies behind the neck, so it belongs to the body layer
    body: (c) => {
      const d = "M396 792 C392 704 450 676 512 676 C574 676 632 704 628 792Z";
      return fill(d, shade(c.palette.clothing, 0.28)) + stroke(d);
    },
    clothing: (c) => {
      const { clothing: color } = c.palette;
      const string = (x: number, lean: number) => {
        const d = `M${x} 858 C${x - lean} 900 ${x - lean} 930 ${x - lean * 2} 972`;
        return stroke(d, 9) + stroke(d, 5, tint(color, luminance(color) < 0.05 ? 0.75 : 0.55)) + `<rect x="${x - lean * 2 - 5}" y="968" width="10" height="18" rx="3" fill="${seam(color, 0.2)}" stroke="${INK}" stroke-width="2.5"/>`;
      };
      return (
        body(c, "deepCrew") +
        band([[396, 776], [438, 860], [512, 884], [586, 860], [628, 776]], NECKLINE.deepCrew!, luminance(color) < 0.05 ? tint(color, 0.07) : shade(color, 0.12)) +
        string(486, 4) +
        string(538, -4) +
        stroke("M412 1010 C470 994 554 994 612 1010", 3.5, seam(color))
      );
    },
  }),
  clothing("tshirt", "Tişört", {
    clothing: (c) =>
      body(c, "crew") + band([[436, 758], [470, 806], [512, 818], [554, 806], [588, 758]], NECKLINE.crew!, seam(c.palette.clothing, 0.1)),
  }),
  clothing("sweater", "Kazak", {
    clothing: (c) => {
      const color = c.palette.clothing;
      const ribs = [470, 490, 512, 534, 554].map((x) => `M${x} ${x === 512 ? 806 : 800} L${x + (x - 512) * 0.1} ${x === 512 ? 826 : 820}`).join(" ");
      return (
        body(c, "crew") +
        band([[428, 760], [466, 818], [512, 832], [558, 818], [596, 760]], NECKLINE.crew!, seam(color, 0.1)) +
        stroke(ribs, 2.5, seam(color)) +
        stroke("M430 840 C380 880 300 890 236 906 M594 840 C644 880 724 890 788 906", 3.5, seam(color))
      );
    },
  }),
  clothing("shirt", "Gömlek", {
    clothing: (c) => {
      const color = c.palette.clothing;
      const flap = (side: 1 | -1) => {
        const points: Point[] = [[458, 754], [424, 812], [500, 850], [512, 826]];
        const d = smoothClosedPath(side === 1 ? points : points.map((p) => mirrorX(p)), 0.3);
        return fill(d, tint(color, 0.08)) + stroke(d, 4.5);
      };
      return (
        body(c, "collar") +
        stroke("M512 840 L512 1030", 3.5, seam(color, 0.4)) +
        bead(526, 880, 5, tint(color, 0.45)) +
        bead(526, 950, 5, tint(color, 0.45)) +
        flap(1) +
        flap(-1)
      );
    },
  }),
  clothing("turtleneck", "Balıkçı yaka", {
    clothing: (c) => body(c, "turtle") + stroke("M458 700 C484 712 540 712 566 700 M456 736 C484 750 540 750 568 736", 3.5, seam(c.palette.clothing, 0.35)),
  }),
  clothing("blazer", "Ceket", {
    clothing: (c) => {
      const color = c.palette.clothing;
      // The shirt underneath contrasts with the jacket, so the lapels read
      const inner = luminance(color) > 0.45 ? "#2a2627" : "#f4f1ec";
      const panel = (side: 1 | -1) => {
        const points: Point[] = [[120, 1070], [150, 950], [206, 870], [300, 800], [400, 764], [440, 756], [470, 840], [496, 950], [504, 1110], [300, 1110]];
        const d = smoothClosedPath(side === 1 ? points : points.map((p) => mirrorX(p)).reverse(), 0.5);
        const lapel = side === 1 ? "M440 762 L474 858 L450 872 L498 970" : "M584 762 L550 858 L574 872 L526 970";
        return cel(c, `panel${side}`, d, color, shade(color, 0.2), [-18, 8]) + stroke(lapel, 4.5);
      };
      return body(c, "crew", "inner", inner) + panel(1) + panel(-1) + bead(500, 972, 7, seam(color, 0.25));
    },
  }),
  clothing("bomber", "Bomber ceket", {
    clothing: (c) => {
      const color = c.palette.clothing;
      return (
        body(c, "deepCrew") +
        band([[424, 770], [466, 834], [512, 850], [558, 834], [600, 770]], NECKLINE.deepCrew!, seam(color, 0.18)) +
        stroke("M512 850 L512 1030", 5, seam(color, 0.35)) +
        ring("M526 866 L526 890", "#c3c7cc", 4) +
        stroke("M470 870 L472 900 M560 870 L558 900", 3, seam(color, 0.35))
      );
    },
  }),
  clothing("tank", "Askılı", {
    clothing: (c) => {
      const color = c.palette.clothing;
      // The strap runs all the way up over the shoulder and down the back of
      // it, instead of stopping in mid-air the way the first shape did (D-203)
      const d = smoothClosedPath(
        [
          [196, 1070], [240, 966], [318, 912], [322, 830], [324, 774], [364, 756],
          [400, 790], [412, 846], [424, 888],
          [512, 918],
          [600, 888], [612, 846], [624, 790],
          [660, 756], [700, 774], [702, 830], [706, 912],
          [784, 966], [828, 1070], [512, 1110],
        ],
        0.25,
      );
      return (
        cel(c, "tank", d, color, shade(color, 0.2), [-18, 8]) +
        // The seam along the top of each strap, so it reads as folded over
        stroke("M336 786 C356 768 380 772 394 792 M688 786 C668 768 644 772 630 792", 3.5, seam(color, 0.25))
      );
    },
  }),
] as const satisfies readonly Asset[];
