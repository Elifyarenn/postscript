/**
 * Ready-made hair pictures (D-200).
 *
 * Besides the drawn hair in `hair.ts`, a style can be a pair of PNG files: one
 * drawn behind the head, one over the forehead. This is how a hair set from an
 * illustrator (or a licensed set) is added without touching the renderer.
 *
 * To add one:
 *  1. Put the files in `public/avatar-hair/` — transparent PNG, square,
 *     ideally 1024 × 1024, drawn over a finished avatar so the hair already
 *     sits on the head (see the README for a template to draw on).
 *  2. Add an entry to `IMAGE_HAIR` below with its id, Turkish label and files.
 *  3. Record where the pictures came from and under which licence in
 *     `DECISIONS.md`. Nothing goes live without that (FSEK, D-115, D-199).
 *
 * Note: a picture carries its own colour, so the hair colour swatches do not
 * apply to it. The builder says so when such a style is chosen.
 */
import { CANVAS, type DrawContext } from "../canvas";
import type { Asset } from "./types";

/** Where the files live, relative to `public/`. */
export const HAIR_IMAGE_DIR = "avatar-hair";

export type HairImage = {
  id: string;
  label: string;
  /** Over the forehead, drawn in front of the face. */
  front: string;
  /** Behind the head, drawn before the body; optional. */
  back?: string;
  /**
   * Where the picture sits on the canvas. The default covers it whole, which
   * is what a file drawn over a finished avatar needs.
   */
  box?: { x: number; y: number; size: number };
};

const DEFAULT_BOX = { x: 0, y: 0, size: CANVAS };

// Pictures sit on the finished canvas, not in head space: a hair set is drawn
// over a whole avatar, so it must not be scaled a second time
function picture(context: DrawContext, file: string, box = DEFAULT_BOX): string {
  return `<image href="${context.imageHref(file)}" x="${box.x}" y="${box.y}" width="${box.size}" height="${box.size}" preserveAspectRatio="xMidYMid meet"/>`;
}

export function imageHairStyle(image: HairImage): Asset {
  return {
    id: image.id,
    label: image.label,
    layers: {
      backHair: image.back ? (context) => picture(context, image.back!, image.box) : undefined,
      frontHair: (context) => picture(context, image.front, image.box),
    },
  };
}

/**
 * The picture-based styles in the catalogue. Empty until a set with a clear
 * licence is in hand; `sample` is our own drawn hair, exported to PNG, so the
 * path can be seen working end to end.
 */
export const IMAGE_HAIR: HairImage[] = [
  { id: "imageSample", label: "Görsel saç (örnek)", front: "sample-front.png", back: "sample-back.png" },
];

/** True for a style whose colour comes from its picture, not from the palette. */
export function isImageHair(styleId: string): boolean {
  return IMAGE_HAIR.some((image) => image.id === styleId);
}
