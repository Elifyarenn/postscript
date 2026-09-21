/**
 * Clothing (D-195; the drawings themselves became the product-owner-corrected
 * static geometry in D-215).
 *
 * The garments live in `clothing-static.ts` as template strings drawn
 * straight on the 1024 canvas; this module only lists them and the garment
 * colours.
 */
import type { Asset, ColorOption } from "./types";
import { CLOTHING_STATIC, clothingStaticStyle } from "./clothing-static";

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

export const CLOTHING: readonly Asset[] = CLOTHING_STATIC.map(clothingStaticStyle);