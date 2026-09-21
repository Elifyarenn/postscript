/**
 * Hair styles, textures and colours (D-195; the drawings themselves became
 * the product-owner-corrected static geometry in D-215, with the bukle set
 * added in D-217).
 *
 * The styles live in `hair-static.ts` as template strings drawn straight on
 * the 1024 canvas; this module only lists them, the hair colours and the
 * textures. The straight texture draws the base set; wavy and curly draw the
 * "dağınık bukle" set (D-217). The texture also shapes the beard (D-195).
 */
import type { Asset, ColorOption } from "./types";
import { HAIR_STATIC, hairStaticStyle } from "./hair-static";

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
] as const satisfies readonly Asset[];

/** The sixteen corrected styles, plus the bald head that draws nothing. */
export const HAIR_STYLES: readonly Asset[] = [...HAIR_STATIC.map(hairStaticStyle), { id: "bald", label: "Saçsız" }];