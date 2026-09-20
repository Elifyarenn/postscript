/**
 * Hair drawn as SVG paths (D-201).
 *
 * A third way to add hair, beside the generated locks in `hair.ts` and the
 * picture files in `hair-images.ts`: paste the paths of a hand-drawn hair
 * style here. The paths keep their own coordinates (they are usually drawn on
 * a 400 box) and `place` puts them on the avatar's head, so the drawing does
 * not have to be redrawn in canvas units.
 *
 * Colours are ours, not the file's: the fill follows the chosen hair colour,
 * the highlight its lighter tone and the outline the shared ink, so every
 * style still works in all eighteen colours.
 *
 * To add one:
 *  1. Draw the hair over a 400 × 400 head (or any square), split into what is
 *     behind the head and what falls over the forehead.
 *  2. Add an entry below: the path strings, and `place` (scale and offset).
 *     `previewPlacement` in the README says how to check the fit.
 */
import { INK, OUTLINE, fill, stroke, type DrawContext } from "../canvas";
import { luminance, mix, shade } from "../geometry";
import type { Asset } from "./types";

export type PathHair = {
  id: string;
  label: string;
  /** Behind the head; drawn before the body. */
  back?: readonly string[];
  /** Over the forehead; drawn after the face. */
  front?: readonly string[];
  /** Thin strokes over the hair, in the lighter tone. */
  highlights?: readonly string[];
  /** Puts the drawing on the head: `scale` first, then `x`/`y` in canvas units. */
  place: { scale: number; x: number; y: number };
  /** Highlight stroke width, in the drawing's own units (not canvas units). */
  highlightWidth?: number;
};

function draw(context: DrawContext, hair: PathHair, paths: readonly string[], highlights: readonly string[] = []): string {
  const { scale, x, y } = hair.place;
  // Line weights are written in canvas units and divided back, so a hair style
  // drawn at any size still carries the same outline as the face
  const outline = OUTLINE / scale;
  // The outline is normalised to the face's weight, but a highlight is part of
  // the drawing's own look, so it keeps the width it was drawn with
  const highlight = hair.highlightWidth ?? 6;
  const body = paths
    .map((d) => fill(d, context.palette.hair) + stroke(d, outline, INK, ` stroke-linejoin="round"`))
    .join("");

  // A highlight is the hair colour lifted a little, the way the drawing has it;
  // the strand colour of the generated hair would read as grey here
  const color = context.palette.hair;
  // Warm, not grey: lifting a dark brown towards white turns it ashen
  const lifted = luminance(color) < 0.3 ? mix(color, "#c08a4e", 0.34) : shade(color, 0.2);
  const sheen = highlights
    .map((d) => stroke(d, highlight, lifted, ` stroke-linecap="round" opacity="0.55"`))
    .join("");
  return `<g transform="translate(${x} ${y}) scale(${scale})">${body}${sheen}</g>`;
}

export function pathHairStyle(hair: PathHair): Asset {
  return {
    id: hair.id,
    label: hair.label,
    layers: {
      backHair: hair.back ? (context) => draw(context, hair, hair.back!) : undefined,
      frontHair: hair.front ? (context) => draw(context, hair, hair.front!, hair.highlights) : undefined,
    },
  };
}

/** True for a style drawn by hand, whose texture is already in its paths. */
export function isPathHair(styleId: string): boolean {
  return PATH_HAIR.some((hair) => hair.id === styleId);
}

/** Hand-drawn styles, in the order they appear in the builder. */
export const PATH_HAIR: PathHair[] = [
  {
    id: "straight01",
    label: "Düz 01",
    // Drawn on a 400 box; scaled up and centred on the avatar's head
    place: { scale: 2.62, x: -16, y: -28 },
    back: [
      `M105 178 C92 118 122 60 198 55 C278 51 311 112 298 185 L286 310 C267 325 245 331 225 326 L218 190 C211 168 190 163 176 183 L165 326 C142 329 119 319 105 304 Z`,
    ],
    front: [
      `M198 58 C151 60 119 89 111 137 C128 119 149 103 176 94 C169 126 148 157 119 180 C143 174 169 158 187 133 C180 160 163 181 145 198 C177 184 198 154 205 116 Z`,
      `M198 58 C247 60 281 88 292 137 C270 115 249 102 224 94 C231 127 251 157 281 179 C255 175 231 159 212 134 C220 159 238 181 256 197 C224 184 204 153 197 116 Z`,
    ],
    highlights: [`M137 104 C126 145 128 205 132 260`, `M260 103 C274 149 272 205 267 263`],
  },
];
