/**
 * The avatar asset registry's building blocks (D-195).
 *
 * An asset is one choosable part: its id (what the configuration stores), its
 * Turkish label, and a drawing per layer it takes part in. Adding a hair
 * style, a top or a piercing is adding one entry to the matching list in
 * `assets/`; the renderer, the builder and the admin panel read the lists.
 */
import type { DrawContext, LayerName } from "../canvas";

export type Draw = (context: DrawContext) => string;

export type Asset = {
  readonly id: string;
  readonly label: string;
  readonly layers?: Partial<Record<LayerName, Draw>>;
};

export type ColorOption = { readonly id: string; readonly label: string; readonly hex: string };

/** The "nothing chosen" entry many lists start with. */
export const NONE: Asset = { id: "none", label: "Yok" };
