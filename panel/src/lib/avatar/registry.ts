/**
 * The avatar asset registry (D-195): the one place that says which parts
 * exist, how they are grouped in the builder, and what a saved configuration
 * may contain.
 *
 * The builder's categories, sub-tabs and thumbnails, the renderer's layers,
 * the validation schema and the admin panel's configuration table are all
 * derived from `FIELDS` and `CATEGORIES`. A new hair style or top is added in
 * its `assets/` list and appears everywhere.
 *
 * The configuration holds only catalogue ids. Nothing free-form reaches the
 * SVG, and an old record can be loaded back into the builder.
 */
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { EARRINGS, EXTRAS, GLASSES, GLASSES_COLORS, HEADWEAR, HEADWEAR_COLORS, JEWELRY_COLORS, NECKLACES, PIERCINGS } from "./assets/accessories";
import { CLOTHING, CLOTHING_COLORS } from "./assets/clothing";
import { BLUSH, FACIAL_HAIR, FRECKLES, MOLES, SCARS, UNDER_EYE } from "./assets/details";
import { FACES, SKIN_TONES } from "./assets/face";
import { EYEBROWS, EYELASHES, EYES, EYE_COLORS, LIP_COLORS, MOUTHS, NOSES } from "./assets/features";
import { HAIR_COLORS, HAIR_STYLES, HAIR_TEXTURES } from "./assets/hair";
import { IMAGE_HAIR, imageHairStyle, isImageHair } from "./assets/hair-images";
import { PATH_HAIR, isPathHair, pathHairStyle } from "./assets/hair-paths";
import { SHAPE_HAIR, isShapeHair, shapeHairStyle } from "./assets/hair-shapes";
import type { Asset, ColorOption } from "./assets/types";
import type { LayerName } from "./canvas";

export type { Asset, ColorOption };

/** Which part of the canvas an option's thumbnail zooms into (canvas units, square). */
export const THUMBS = {
  hair: "92 20 840 840",
  face: "172 120 680 680",
  eyes: "342 329 340 340",
  brows: "342 264 340 340",
  nose: "402 427 220 220",
  mouth: "392 516 240 240",
  cheeks: "282 357 460 460",
  jaw: "272 406 480 480",
  glasses: "282 269 460 460",
  ears: "232 323 560 560",
  piercing: "232 283 560 560",
  neck: "302 580 420 420",
  body: "262 524 500 500",
  full: "50 50 924 924",
} as const;

export type ThumbView = keyof typeof THUMBS;

/** Layers left out of a thumbnail, so a hair tile shows the hair on a plain face. */
const FEATURE_LAYERS: LayerName[] = ["skinDetails", "eyes", "eyebrows", "nose", "mouth", "facialHair", "glasses", "earrings", "piercings", "necklace", "accessories"];

type AssetField = { label: string; kind: "asset"; options: readonly Asset[]; thumb: ThumbView; omit?: LayerName[] };
type SetField = { label: string; kind: "set"; options: readonly Asset[]; thumb: ThumbView; hint?: string };
type ColorField = { label: string; kind: "color"; options: readonly ColorOption[] };
export type Field = AssetField | SetField | ColorField;

/** Every choice, in drawing priority: within a layer, earlier fields draw first. */
export const FIELDS = {
  face: { label: "Yüz Şekli", kind: "asset", options: FACES, thumb: "face" },
  skinTone: { label: "Ten Rengi", kind: "color", options: SKIN_TONES },
  // Drawn styles first, then any ready-made picture sets (D-200)
  hairStyle: {
    label: "Saç Modeli",
    kind: "asset",
    // Shape styles first (D-204), then the older generated ones, the
    // hand-drawn ones (D-201) and any picture sets (D-200)
    options: [
      ...SHAPE_HAIR.map(shapeHairStyle),
      ...HAIR_STYLES,
      ...PATH_HAIR.map(pathHairStyle),
      ...IMAGE_HAIR.map(imageHairStyle),
    ],
    thumb: "hair",
    omit: FEATURE_LAYERS,
  },
  hairTexture: { label: "Saç Dokusu", kind: "asset", options: HAIR_TEXTURES, thumb: "hair", omit: FEATURE_LAYERS },
  hairColor: { label: "Saç Rengi", kind: "color", options: HAIR_COLORS },
  eyes: { label: "Göz Şekli", kind: "asset", options: EYES, thumb: "eyes" },
  eyelashes: { label: "Kirpik", kind: "asset", options: EYELASHES, thumb: "eyes" },
  eyeColor: { label: "Göz Rengi", kind: "color", options: EYE_COLORS },
  eyebrows: { label: "Kaşlar", kind: "asset", options: EYEBROWS, thumb: "brows" },
  nose: { label: "Burun", kind: "asset", options: NOSES, thumb: "nose" },
  mouth: { label: "Ağız", kind: "asset", options: MOUTHS, thumb: "mouth" },
  lipColor: { label: "Dudak Rengi", kind: "color", options: LIP_COLORS },
  freckles: { label: "Çil", kind: "asset", options: FRECKLES, thumb: "cheeks" },
  mole: { label: "Ben", kind: "asset", options: MOLES, thumb: "cheeks" },
  blush: { label: "Allık", kind: "asset", options: BLUSH, thumb: "cheeks" },
  underEye: { label: "Göz Altı", kind: "asset", options: UNDER_EYE, thumb: "eyes" },
  scar: { label: "Yara İzi", kind: "asset", options: SCARS, thumb: "cheeks" },
  facialHair: { label: "Sakal & Bıyık", kind: "asset", options: FACIAL_HAIR, thumb: "jaw" },
  glasses: { label: "Gözlük", kind: "asset", options: GLASSES, thumb: "glasses" },
  glassesColor: { label: "Çerçeve Rengi", kind: "color", options: GLASSES_COLORS },
  piercings: { label: "Piercing", kind: "set", options: PIERCINGS, thumb: "piercing", hint: "Birden fazla seçebilirsiniz." },
  earrings: { label: "Küpe", kind: "asset", options: EARRINGS, thumb: "ears" },
  necklace: { label: "Kolye", kind: "asset", options: NECKLACES, thumb: "neck" },
  jewelryColor: { label: "Takı Rengi", kind: "color", options: JEWELRY_COLORS },
  clothing: { label: "Kıyafet", kind: "asset", options: CLOTHING, thumb: "body" },
  clothingColor: { label: "Kıyafet Rengi", kind: "color", options: CLOTHING_COLORS },
  extras: { label: "Ekstra", kind: "set", options: EXTRAS, thumb: "full", hint: "İstediğiniz kadarını ekleyin." },
  headwearColor: { label: "Şapka Rengi", kind: "color", options: HEADWEAR_COLORS },
} as const satisfies Record<string, Field>;

export type FieldKey = keyof typeof FIELDS;
export type SetKey = { [K in FieldKey]: (typeof FIELDS)[K]["kind"] extends "set" ? K : never }[FieldKey];
export type SingleKey = Exclude<FieldKey, SetKey>;

/** The builder's left-hand navigation, in the reference's order. */
export const CATEGORIES = [
  { id: "hair", label: "Saç", fields: ["hairStyle", "hairTexture", "hairColor"] },
  { id: "face", label: "Yüz", fields: ["face"] },
  { id: "skin", label: "Ten Rengi", fields: ["skinTone"] },
  { id: "eyes", label: "Gözler", fields: ["eyes", "eyelashes", "eyeColor"] },
  { id: "brows", label: "Kaşlar", fields: ["eyebrows"] },
  { id: "nose", label: "Burun", fields: ["nose"] },
  { id: "mouth", label: "Ağız", fields: ["mouth", "lipColor"] },
  { id: "details", label: "Yüz Detayları", fields: ["freckles", "mole", "blush", "underEye", "scar", "facialHair"] },
  { id: "glasses", label: "Gözlük", fields: ["glasses", "glassesColor"] },
  { id: "piercing", label: "Piercing", fields: ["piercings", "jewelryColor"] },
  { id: "accessory", label: "Aksesuar", fields: ["earrings", "necklace", "jewelryColor"] },
  { id: "clothing", label: "Kıyafet", fields: ["clothing", "clothingColor"] },
  { id: "extra", label: "Ekstra", fields: ["extras", "headwearColor"] },
] as const satisfies readonly { id: string; label: string; fields: readonly FieldKey[] }[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/**
 * Whether the hair texture choice means anything for this style. The older
 * generated styles are drawn in all four textures; a shape style (D-204), a
 * hand-drawn one or a picture carries its own, so the builder hides the
 * texture tab for them (D-202).
 */
export function hairFollowsTexture(hairStyleId: string): boolean {
  return !isShapeHair(hairStyleId) && !isPathHair(hairStyleId) && !isImageHair(hairStyleId);
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Bumped whenever the drawing changes meaning; v1 was the first style (D-194),
 * v2 the reference rework (D-195), v3 the hat colour of its own (D-203).
 */
export const AVATAR_CONFIG_VERSION = 3;

type IdsOf<K extends FieldKey> = (typeof FIELDS)[K]["options"][number]["id"];

function idEnum<K extends FieldKey>(key: K) {
  const ids = FIELDS[key].options.map((option) => option.id);
  return z.enum(ids as [IdsOf<K>, ...IdsOf<K>[]]);
}

/** A set in spirit: duplicates dropped, catalogue order kept, so equal avatars serialise equally. */
function idSet<K extends SetKey>(key: K) {
  const order = FIELDS[key].options.map((option) => option.id) as IdsOf<K>[];
  return z
    .array(idEnum(key))
    .max(order.length)
    .transform((list) => order.filter((id) => list.includes(id)));
}

const shape = Object.fromEntries(
  (Object.keys(FIELDS) as FieldKey[]).map((key) => [key, FIELDS[key].kind === "set" ? idSet(key as SetKey) : idEnum(key)]),
) as { [K in SingleKey]: ReturnType<typeof idEnum<K>> } & { [K in SetKey]: ReturnType<typeof idSet<K>> };

export const avatarConfigSchema = z.object({ v: z.literal(AVATAR_CONFIG_VERSION), ...shape }).strict();

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  v: AVATAR_CONFIG_VERSION,
  face: "vShape",
  skinTone: "tone3",
  hairStyle: "messy",
  hairTexture: "wavy",
  hairColor: "black",
  eyes: "almond",
  eyelashes: "none",
  eyeColor: "darkBrown",
  eyebrows: "natural",
  nose: "small",
  mouth: "neutral",
  lipColor: "natural",
  freckles: "none",
  mole: "none",
  blush: "soft",
  underEye: "none",
  scar: "none",
  facialHair: "none",
  glasses: "none",
  glassesColor: "black",
  piercings: [],
  earrings: "none",
  necklace: "none",
  jewelryColor: "silver",
  clothing: "hoodie",
  clothingColor: "black",
  extras: [],
  headwearColor: "black",
};

/** Example avatars shown under the builder; a click starts from one of them. */
export const PRESETS: readonly { label: string; config: AvatarConfig }[] = [
  { label: "Dağınık ve piercingli", config: { ...DEFAULT_AVATAR_CONFIG, mole: "eyeCorner", piercings: ["helix", "industrial"], earrings: "smallHoop" } },
  { label: "Uzun dalgalı", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "long", hairColor: "darkBrown", eyes: "round", eyelashes: "soft", mouth: "smile", earrings: "drop", clothing: "tank", clothingColor: "black", face: "oval" } },
  { label: "Kızıl ve gözlüklü", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "shortMessy", hairTexture: "curly", hairColor: "red", glasses: "round", skinTone: "tone2", freckles: "light", extras: ["headphones"], clothing: "tshirt" } },
  { label: "İki topuz", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "spaceBuns", hairTexture: "wavy", hairColor: "platinum", skinTone: "tone1", eyes: "round", eyeColor: "gray", blush: "rosy", clothing: "hoodie", clothingColor: "gray", mouth: "cat" } },
  { label: "Şapkalı", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "wolf", skinTone: "tone5", extras: ["cap"], headwearColor: "rust", clothing: "bomber", clothingColor: "charcoal", eyebrows: "thick", mouth: "smirk" } },
  { label: "Düz siyah", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "longBangs", hairTexture: "straight", glasses: "square", eyes: "cat", clothing: "shirt", clothingColor: "white", face: "oval", eyelashes: "soft" } },
  { label: "Kıvırcık ve çilli", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "volume", hairTexture: "coily", hairColor: "brown", skinTone: "tone6", freckles: "dense", necklace: "layered", jewelryColor: "gold", earrings: "bigHoop", clothing: "blazer", clothingColor: "rust", face: "round" } },
  { label: "Kulaklıklı", config: { ...DEFAULT_AVATAR_CONFIG, hairStyle: "curtain", hairTexture: "wavy", hairColor: "ash", skinTone: "tone7", extras: ["headphones"], piercings: ["eyebrow", "lobeStack"], eyes: "sleepy", clothing: "sweater", clothingColor: "black", scar: "brow" } },
];

/* ------------------------------------------------------------------ */
/* Reading stored records                                              */
/* ------------------------------------------------------------------ */

/** Carries a first-version record (D-194) over to today's keys and closest parts. */
function fromVersion1(source: Record<string, unknown>): Record<string, unknown> {
  const pick = (map: Record<string, string>, value: unknown) => (typeof value === "string" ? map[value] ?? value : undefined);
  const extras = Array.isArray(source.extras) ? (source.extras as string[]) : [];
  return {
    face: pick({ oval: "oval", round: "round", square: "softSquare", heart: "heart", long: "oval", diamond: "vShape" }, source.faceShape),
    skinTone: source.skinTone,
    hairStyle: pick({ crop: "shortMessy", quiff: "sidePart", shoulder: "curtain", shag: "wolf", afro: "volume" }, source.hairStyle),
    hairTexture: source.hairTexture,
    hairColor: pick({ lilac: "lilac" }, source.hairColor),
    eyes: pick({ upturned: "cat", downturned: "droopy" }, source.eyeShape),
    eyeColor: source.eyeColor,
    eyebrows: pick({ thin: "short", bushy: "thick" }, source.eyebrows),
    mouth: pick({ grin: "teeth", laugh: "open", full: "smile" }, source.mouth),
    lipColor: pick({ cherry: "berry", nude: "natural" }, source.lipColor),
    freckles: source.freckles,
    mole: pick({ eye: "eyeCorner" }, source.mole),
    blush: extras.includes("blush") ? "soft" : "none",
    facialHair: source.facialHair,
    glasses: pick({ rectangle: "square", oversized: "bigRound" }, source.glasses),
    glassesColor: source.glassesColor,
    piercings: source.piercing === "helix" ? ["helix"] : typeof source.piercing === "string" && source.piercing !== "none" ? [source.piercing] : [],
    earrings: source.earrings,
    necklace: source.necklace,
    jewelryColor: source.jewelryColor,
    clothing: pick({ vneck: "tshirt" }, source.top),
    clothingColor: pick({ white: "white" }, source.topColor),
    extras: extras.filter((extra) => extra !== "blush"),
  };
}

/**
 * Reads a stored configuration of any version. Keys that no longer parse (an
 * option since removed, a part the first version did not have) fall back to
 * the default one by one, so the rest of the avatar survives.
 */
export function parseStoredConfig(value: unknown): AvatarConfig {
  const direct = avatarConfigSchema.safeParse(value);
  if (direct.success) return direct.data;

  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  let source = raw.v === 1 ? fromVersion1(raw) : raw;
  // Before D-203 a hat took the clothing colour, so an older avatar keeps its look
  if (source.headwearColor === undefined && typeof source.clothingColor === "string") {
    source = { ...source, headwearColor: source.clothingColor };
  }
  const merged: Record<string, unknown> = { ...DEFAULT_AVATAR_CONFIG };
  for (const key of Object.keys(FIELDS) as FieldKey[]) {
    if (source[key] === undefined) continue;
    const candidate = { ...DEFAULT_AVATAR_CONFIG, [key]: source[key] };
    if (avatarConfigSchema.safeParse(candidate).success) merged[key] = source[key];
  }
  return avatarConfigSchema.parse(merged);
}

/* ------------------------------------------------------------------ */
/* Random                                                              */
/* ------------------------------------------------------------------ */

/**
 * A random but coherent avatar: every single choice from its list, but
 * accessories and unusual colours only now and then, so "Rastgele" gives a
 * person rather than a costume.
 */
export function randomAvatarConfig(random: () => number = Math.random): AvatarConfig {
  const pickFrom = <T extends { id: string }>(options: readonly T[]) => options[Math.floor(random() * options.length)]!.id;
  const config: Record<string, unknown> = { v: AVATAR_CONFIG_VERSION };
  for (const key of Object.keys(FIELDS) as FieldKey[]) {
    const field = FIELDS[key];
    config[key] = field.kind === "set" ? [] : pickFrom(field.options as readonly { id: string }[]);
  }

  const chance = (probability: number) => random() < probability;
  if (!chance(0.25)) config.hairColor = pickFrom(HAIR_COLORS.slice(0, 12));
  if (!chance(0.3)) config.glasses = "none";
  if (!chance(0.3)) config.facialHair = "none";
  if (!chance(0.4)) config.mole = "none";
  if (!chance(0.2)) config.scar = "none";
  if (!chance(0.3)) config.underEye = "none";
  if (!chance(0.4)) config.necklace = "none";
  if (!chance(0.5)) config.earrings = "none";
  config.piercings = PIERCINGS.filter(() => chance(0.12)).map((piercing) => piercing.id);
  config.extras = EXTRAS.filter((extra) => chance(HEADWEAR.has(extra.id) ? 0.05 : 0.1)).map((extra) => extra.id);
  // One hat at most
  const hats = (config.extras as string[]).filter((id) => HEADWEAR.has(id));
  if (hats.length > 1) config.extras = (config.extras as string[]).filter((id) => !HEADWEAR.has(id) || id === hats[0]);
  return avatarConfigSchema.parse(config);
}

/* ------------------------------------------------------------------ */
/* Labels for the admin panel                                          */
/* ------------------------------------------------------------------ */

/** Every stored choice as "label: value" rows, in the builder's order. */
export function describeConfig(config: AvatarConfig): { label: string; value: string }[] {
  const seen = new Set<FieldKey>();
  const rows: { label: string; value: string }[] = [];
  for (const category of CATEGORIES) {
    for (const key of category.fields as readonly FieldKey[]) {
      if (seen.has(key)) continue;
      seen.add(key);
      const field: Field = FIELDS[key];
      const options: readonly { id: string; label: string }[] = field.options;
      const stored = config[key] as string | string[];
      const value = Array.isArray(stored)
        ? options.filter((option) => stored.includes(option.id)).map((option) => option.label).join(", ") || "Yok"
        : (options.find((option) => option.id === stored)?.label ?? stored);
      rows.push({ label: field.label, value });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Team details                                                        */
/* ------------------------------------------------------------------ */

export const TEAM_ROLE_SUGGESTIONS = [
  "Genel Yayın Yönetmeni",
  "Editör",
  "Yazar",
  "Çizer",
  "Tasarımcı",
  "Sosyal Medya",
  "Redaktör",
  "Fotoğrafçı",
] as const;

export const teamAvatarDetailsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Görünen ad en az 2 karakter olmalı.")
    .max(60, "Görünen ad en fazla 60 karakter olabilir."),
  teamRole: z
    .string()
    .trim()
    .min(2, "Ekipteki rolünüz en az 2 karakter olmalı.")
    .max(60, "Ekipteki rolünüz en fazla 60 karakter olabilir."),
});

/** "Elif Yaren Çekiç" → "elif-yaren-cekic-avatar.png". */
export function avatarFileName(displayName: string): string {
  return `${slugify(displayName) || "ekip-uyesi"}-avatar.png`;
}
