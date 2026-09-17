/**
 * The team avatar's parts catalogue (D-194).
 *
 * Every choice a member can make is an id from a fixed list, and the saved
 * configuration holds only those ids. That is what makes the renderer safe to
 * run on the server (nothing free-form reaches the SVG) and what lets an old
 * avatar be loaded back into the builder for editing.
 *
 * No option is tied to a gender: every hair style, top and accessory is
 * offered to everyone, and the labels describe the shape, not the wearer.
 * Skin tones are numbered rather than named, because a name would suggest
 * the builder records an ethnicity; it records a drawing choice.
 */
import { z } from "zod";
import { slugify } from "@/lib/slug";

export type Option = { id: string; label: string };
export type ColorOption = Option & { hex: string };

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

export const SKIN_TONES = [
  { id: "tone1", label: "Ten tonu 1", hex: "#f9dfcf" },
  { id: "tone2", label: "Ten tonu 2", hex: "#f2cdb4" },
  { id: "tone3", label: "Ten tonu 3", hex: "#e9b995" },
  { id: "tone4", label: "Ten tonu 4", hex: "#d9a077" },
  { id: "tone5", label: "Ten tonu 5", hex: "#c68a5e" },
  { id: "tone6", label: "Ten tonu 6", hex: "#a86f48" },
  { id: "tone7", label: "Ten tonu 7", hex: "#8c5a3a" },
  { id: "tone8", label: "Ten tonu 8", hex: "#6e432a" },
  { id: "tone9", label: "Ten tonu 9", hex: "#55321f" },
  { id: "tone10", label: "Ten tonu 10", hex: "#3f2418" },
] as const satisfies readonly ColorOption[];

export const HAIR_COLORS = [
  { id: "black", label: "Siyah", hex: "#231d1f" },
  { id: "darkBrown", label: "Koyu kahve", hex: "#3d2a22" },
  { id: "brown", label: "Kahverengi", hex: "#6a4430" },
  { id: "auburn", label: "Kestane", hex: "#8a3b25" },
  { id: "copper", label: "Bakır", hex: "#c2622f" },
  { id: "darkBlonde", label: "Koyu sarı", hex: "#b98b4e" },
  { id: "blonde", label: "Sarı", hex: "#e3c07a" },
  { id: "platinum", label: "Platin", hex: "#efe3c4" },
  { id: "gray", label: "Kır", hex: "#9c9a98" },
  { id: "white", label: "Beyaz", hex: "#ebe8e3" },
  { id: "burgundy", label: "Bordo", hex: "#7a1f2b" },
  { id: "pink", label: "Pembe", hex: "#e58fb0" },
  { id: "lilac", label: "Mor", hex: "#7b5bb5" },
  { id: "blue", label: "Mavi", hex: "#4f79c9" },
  { id: "green", label: "Yeşil", hex: "#4f9a78" },
] as const satisfies readonly ColorOption[];

export const EYE_COLORS = [
  { id: "darkBrown", label: "Koyu kahve", hex: "#3b2418" },
  { id: "brown", label: "Kahverengi", hex: "#6b4226" },
  { id: "hazel", label: "Ela", hex: "#8a6a2f" },
  { id: "amber", label: "Kehribar", hex: "#b0782a" },
  { id: "green", label: "Yeşil", hex: "#4f7a4a" },
  { id: "blue", label: "Mavi", hex: "#4d7fb0" },
  { id: "gray", label: "Gri", hex: "#7d8a93" },
  { id: "black", label: "Siyah", hex: "#1d1716" },
] as const satisfies readonly ColorOption[];

/** `natural` has no fixed colour: the renderer derives it from the skin tone. */
export const LIP_COLORS = [
  { id: "natural", label: "Doğal", hex: "" },
  { id: "rose", label: "Gül", hex: "#c9727a" },
  { id: "nude", label: "Nude", hex: "#c79a82" },
  { id: "red", label: "Kırmızı", hex: "#c0303a" },
  { id: "cherry", label: "Vişne", hex: "#9c2f45" },
  { id: "plum", label: "Erik", hex: "#6e2a45" },
  { id: "brown", label: "Kahve", hex: "#7a4a3a" },
] as const satisfies readonly ColorOption[];

export const TOP_COLORS = [
  { id: "burgundy", label: "Bordo", hex: "#7a1f2b" },
  { id: "black", label: "Siyah", hex: "#2a2627" },
  { id: "white", label: "Beyaz", hex: "#f4f1ec" },
  { id: "cream", label: "Krem", hex: "#e8dcc4" },
  { id: "navy", label: "Lacivert", hex: "#26324f" },
  { id: "forest", label: "Orman yeşili", hex: "#2f5a45" },
  { id: "olive", label: "Zeytin", hex: "#6b6b3a" },
  { id: "mustard", label: "Hardal", hex: "#d4a23a" },
  { id: "rust", label: "Kiremit", hex: "#b5532f" },
  { id: "pink", label: "Pembe", hex: "#e7a3b5" },
  { id: "lilac", label: "Lila", hex: "#a996c9" },
  { id: "sky", label: "Gök mavisi", hex: "#8fb6d9" },
  { id: "gray", label: "Gri", hex: "#8a8a8f" },
] as const satisfies readonly ColorOption[];

export const GLASSES_COLORS = [
  { id: "black", label: "Siyah", hex: "#1f1b1c" },
  { id: "tortoise", label: "Kaplumbağa", hex: "#7a4b2a" },
  { id: "gold", label: "Altın", hex: "#c9a24a" },
  { id: "silver", label: "Gümüş", hex: "#a9adb3" },
  { id: "burgundy", label: "Bordo", hex: "#7a1f2b" },
  { id: "clear", label: "Şeffaf", hex: "#cfc6ba" },
] as const satisfies readonly ColorOption[];

export const JEWELRY_COLORS = [
  { id: "gold", label: "Altın", hex: "#d4a73a" },
  { id: "silver", label: "Gümüş", hex: "#c3c7cc" },
  { id: "roseGold", label: "Rose gold", hex: "#d59a82" },
  { id: "black", label: "Siyah", hex: "#2b2b2b" },
] as const satisfies readonly ColorOption[];

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export const FACE_SHAPES = [
  { id: "oval", label: "Oval" },
  { id: "round", label: "Yuvarlak" },
  { id: "square", label: "Kare" },
  { id: "heart", label: "Kalp" },
  { id: "long", label: "Uzun" },
  { id: "diamond", label: "Elmas" },
] as const satisfies readonly Option[];

export const EYE_SHAPES = [
  { id: "almond", label: "Badem" },
  { id: "round", label: "Yuvarlak" },
  { id: "monolid", label: "Tek kapak" },
  { id: "downturned", label: "Düşük uçlu" },
  { id: "upturned", label: "Kalkık uçlu" },
  { id: "sleepy", label: "Yarı kapalı" },
] as const satisfies readonly Option[];

export const EYEBROWS = [
  { id: "natural", label: "Doğal" },
  { id: "thick", label: "Kalın" },
  { id: "thin", label: "İnce" },
  { id: "arched", label: "Kavisli" },
  { id: "straight", label: "Düz" },
  { id: "bushy", label: "Gür" },
] as const satisfies readonly Option[];

export const NOSES = [
  { id: "button", label: "Küçük kalkık" },
  { id: "straight", label: "Düz" },
  { id: "wide", label: "Geniş" },
  { id: "pointed", label: "Sivri" },
  { id: "aquiline", label: "Kemerli" },
  { id: "small", label: "Minik" },
] as const satisfies readonly Option[];

export const MOUTHS = [
  { id: "smile", label: "Gülümseme" },
  { id: "neutral", label: "Nötr" },
  { id: "grin", label: "Dişli gülüş" },
  { id: "full", label: "Dolgun dudak" },
  { id: "smirk", label: "Yarım gülüş" },
  { id: "laugh", label: "Kahkaha" },
] as const satisfies readonly Option[];

export const HAIR_STYLES = [
  { id: "bald", label: "Saçsız" },
  { id: "buzz", label: "Çok kısa" },
  { id: "crop", label: "Kısa" },
  { id: "sidePart", label: "Yandan ayrık" },
  { id: "quiff", label: "Kabarık ön" },
  { id: "pixie", label: "Pixie" },
  { id: "curtain", label: "Perdeli" },
  { id: "bob", label: "Küt kâküllü" },
  { id: "shoulder", label: "Omuz boyu" },
  { id: "shag", label: "Katlı kesim" },
  { id: "long", label: "Uzun" },
  { id: "ponytail", label: "At kuyruğu" },
  { id: "bun", label: "Topuz" },
  { id: "spaceBuns", label: "İki topuz" },
  { id: "braids", label: "Örgü" },
  { id: "afro", label: "Afro" },
] as const satisfies readonly Option[];

export const HAIR_TEXTURES = [
  { id: "straight", label: "Düz" },
  { id: "wavy", label: "Dalgalı" },
  { id: "curly", label: "Kıvırcık" },
  { id: "coily", label: "Sık kıvırcık" },
] as const satisfies readonly Option[];

export const FACIAL_HAIR = [
  { id: "none", label: "Yok" },
  { id: "stubble", label: "Hafif sakal" },
  { id: "mustache", label: "Bıyık" },
  { id: "goatee", label: "Keçi sakal" },
  { id: "shortBeard", label: "Kısa sakal" },
  { id: "fullBeard", label: "Gür sakal" },
] as const satisfies readonly Option[];

export const FRECKLES = [
  { id: "none", label: "Yok" },
  { id: "light", label: "Az" },
  { id: "dense", label: "Yoğun" },
] as const satisfies readonly Option[];

export const MOLES = [
  { id: "none", label: "Yok" },
  { id: "cheek", label: "Yanakta" },
  { id: "lip", label: "Dudak üstünde" },
  { id: "eye", label: "Göz altında" },
  { id: "chin", label: "Çenede" },
] as const satisfies readonly Option[];

export const GLASSES = [
  { id: "none", label: "Yok" },
  { id: "round", label: "Yuvarlak" },
  { id: "rectangle", label: "Dikdörtgen" },
  { id: "catEye", label: "Kedi göz" },
  { id: "oversized", label: "Büyük çerçeve" },
  { id: "wire", label: "İnce tel" },
  { id: "sunglasses", label: "Güneş gözlüğü" },
] as const satisfies readonly Option[];

export const EARRINGS = [
  { id: "none", label: "Yok" },
  { id: "stud", label: "Küçük taş" },
  { id: "smallHoop", label: "Küçük halka" },
  { id: "bigHoop", label: "Büyük halka" },
  { id: "drop", label: "Sallantılı" },
  { id: "pearl", label: "İnci" },
] as const satisfies readonly Option[];

export const PIERCINGS = [
  { id: "none", label: "Yok" },
  { id: "noseStud", label: "Burun taşı" },
  { id: "noseRing", label: "Burun halkası" },
  { id: "septum", label: "Septum" },
  { id: "lipRing", label: "Dudak halkası" },
  { id: "eyebrow", label: "Kaş" },
  { id: "helix", label: "Kulak kıkırdağı" },
] as const satisfies readonly Option[];

export const NECKLACES = [
  { id: "none", label: "Yok" },
  { id: "chain", label: "İnce zincir" },
  { id: "pendant", label: "Madalyon" },
  { id: "star", label: "Yıldız uçlu" },
  { id: "pearls", label: "İnci" },
  { id: "choker", label: "Choker" },
] as const satisfies readonly Option[];

export const TOPS = [
  { id: "tshirt", label: "Tişört" },
  { id: "vneck", label: "V yaka" },
  { id: "sweater", label: "Kazak" },
  { id: "turtleneck", label: "Balıkçı yaka" },
  { id: "hoodie", label: "Kapüşonlu" },
  { id: "shirt", label: "Gömlek" },
  { id: "blazer", label: "Ceket" },
  { id: "tank", label: "Askılı" },
] as const satisfies readonly Option[];

/** Small optional touches; unlike the rest, several can be on at once. */
export const EXTRAS = [
  { id: "blush", label: "Allık" },
  { id: "bandage", label: "Yara bandı" },
  { id: "pencil", label: "Kulakta kalem" },
  { id: "hairClip", label: "Toka" },
  { id: "flower", label: "Çiçek" },
  { id: "beret", label: "Bere" },
  { id: "headphones", label: "Boyunda kulaklık" },
] as const satisfies readonly Option[];

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

type Ids<T extends readonly Option[]> = T[number]["id"];

/** zod needs a non-empty tuple; every catalogue above has at least one entry. */
function idEnum<T extends readonly Option[]>(options: T) {
  return z.enum(options.map((option) => option.id) as [Ids<T>, ...Ids<T>[]]);
}

/**
 * Bumped when a saved configuration would draw differently or stop parsing,
 * so an old record can be migrated instead of silently misread.
 */
export const AVATAR_CONFIG_VERSION = 1;

export const avatarConfigSchema = z
  .object({
    v: z.literal(AVATAR_CONFIG_VERSION),
    skinTone: idEnum(SKIN_TONES),
    faceShape: idEnum(FACE_SHAPES),
    freckles: idEnum(FRECKLES),
    mole: idEnum(MOLES),
    eyeShape: idEnum(EYE_SHAPES),
    eyeColor: idEnum(EYE_COLORS),
    eyebrows: idEnum(EYEBROWS),
    nose: idEnum(NOSES),
    mouth: idEnum(MOUTHS),
    lipColor: idEnum(LIP_COLORS),
    hairStyle: idEnum(HAIR_STYLES),
    hairTexture: idEnum(HAIR_TEXTURES),
    hairColor: idEnum(HAIR_COLORS),
    facialHair: idEnum(FACIAL_HAIR),
    glasses: idEnum(GLASSES),
    glassesColor: idEnum(GLASSES_COLORS),
    earrings: idEnum(EARRINGS),
    piercing: idEnum(PIERCINGS),
    necklace: idEnum(NECKLACES),
    jewelryColor: idEnum(JEWELRY_COLORS),
    top: idEnum(TOPS),
    topColor: idEnum(TOP_COLORS),
    // A set in spirit: duplicates are dropped and the order is fixed, so two
    // equal avatars always serialise to the same JSON
    extras: z
      .array(idEnum(EXTRAS))
      .max(EXTRAS.length)
      .transform((list) => EXTRAS.map((extra) => extra.id).filter((id) => list.includes(id))),
  })
  .strict();

export type AvatarConfig = z.infer<typeof avatarConfigSchema>;
export type AvatarExtra = AvatarConfig["extras"][number];

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  v: AVATAR_CONFIG_VERSION,
  skinTone: "tone4",
  faceShape: "oval",
  freckles: "none",
  mole: "none",
  eyeShape: "almond",
  eyeColor: "brown",
  eyebrows: "natural",
  nose: "straight",
  mouth: "smile",
  lipColor: "natural",
  hairStyle: "shag",
  hairTexture: "wavy",
  hairColor: "darkBrown",
  facialHair: "none",
  glasses: "none",
  glassesColor: "black",
  earrings: "none",
  piercing: "none",
  necklace: "none",
  jewelryColor: "gold",
  top: "sweater",
  topColor: "burgundy",
  extras: [],
};

/** Keys that hold a single choice, i.e. every key except the version and the extras. */
export type SingleChoiceKey = Exclude<keyof AvatarConfig, "v" | "extras">;

/**
 * Where each choice lives in the builder, in order. The builder's steps and
 * the admin panel's configuration table both read it, so a new option shows
 * up in both places with one edit.
 */
export const AVATAR_CATEGORIES = [
  { key: "skinTone", label: "Ten rengi", options: SKIN_TONES },
  { key: "faceShape", label: "Yüz şekli", options: FACE_SHAPES },
  { key: "freckles", label: "Çil", options: FRECKLES },
  { key: "mole", label: "Ben", options: MOLES },
  { key: "eyeShape", label: "Göz şekli", options: EYE_SHAPES },
  { key: "eyeColor", label: "Göz rengi", options: EYE_COLORS },
  { key: "eyebrows", label: "Kaş", options: EYEBROWS },
  { key: "nose", label: "Burun", options: NOSES },
  { key: "mouth", label: "Ağız", options: MOUTHS },
  { key: "lipColor", label: "Dudak rengi", options: LIP_COLORS },
  { key: "hairStyle", label: "Saç modeli", options: HAIR_STYLES },
  { key: "hairTexture", label: "Saç dokusu", options: HAIR_TEXTURES },
  { key: "hairColor", label: "Saç rengi", options: HAIR_COLORS },
  { key: "facialHair", label: "Sakal / bıyık", options: FACIAL_HAIR },
  { key: "glasses", label: "Gözlük", options: GLASSES },
  { key: "glassesColor", label: "Çerçeve rengi", options: GLASSES_COLORS },
  { key: "earrings", label: "Küpe", options: EARRINGS },
  { key: "piercing", label: "Piercing", options: PIERCINGS },
  { key: "necklace", label: "Kolye", options: NECKLACES },
  { key: "jewelryColor", label: "Takı rengi", options: JEWELRY_COLORS },
  { key: "top", label: "Üst kıyafet", options: TOPS },
  { key: "topColor", label: "Kıyafet rengi", options: TOP_COLORS },
] as const satisfies readonly { key: SingleChoiceKey; label: string; options: readonly Option[] }[];

/** The Turkish label of a stored choice, for the admin panel. */
export function optionLabel(key: SingleChoiceKey, id: string): string {
  const category = AVATAR_CATEGORIES.find((entry) => entry.key === key);
  const options: readonly Option[] = category?.options ?? [];
  return options.find((option) => option.id === id)?.label ?? id;
}

export function extraLabels(extras: readonly string[]): string[] {
  return EXTRAS.filter((extra) => extras.includes(extra.id)).map((extra) => extra.label);
}

/**
 * Reads a stored configuration. A record that no longer parses (an option
 * removed from the catalogue, say) falls back to the default for just the
 * broken keys, so the admin panel still shows the rest of the avatar.
 */
export function parseStoredConfig(value: unknown): AvatarConfig {
  const direct = avatarConfigSchema.safeParse(value);
  if (direct.success) return direct.data;

  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...DEFAULT_AVATAR_CONFIG };
  for (const key of Object.keys(DEFAULT_AVATAR_CONFIG) as (keyof AvatarConfig)[]) {
    if (key === "v") continue;
    const candidate = { ...DEFAULT_AVATAR_CONFIG, [key]: source[key] };
    if (avatarConfigSchema.safeParse(candidate).success) merged[key] = source[key];
  }
  return avatarConfigSchema.parse(merged);
}

/** A random but always valid avatar, for the builder's "Rastgele" button. */
export function randomAvatarConfig(random: () => number = Math.random): AvatarConfig {
  const pick = <T extends readonly Option[]>(options: T): Ids<T> =>
    options[Math.floor(random() * options.length)]!.id as Ids<T>;

  const config: AvatarConfig = { ...DEFAULT_AVATAR_CONFIG };
  for (const category of AVATAR_CATEGORIES) {
    (config as Record<string, unknown>)[category.key] = pick(category.options);
  }
  // Accessories on every random face would look like a costume; keep them rare
  if (random() < 0.6) config.glasses = "none";
  if (random() < 0.6) config.piercing = "none";
  if (random() < 0.5) config.necklace = "none";
  if (random() < 0.5) config.facialHair = "none";
  if (random() < 0.5) config.mole = "none";
  config.extras = EXTRAS.filter(() => random() < 0.12).map((extra) => extra.id);
  return config;
}

/* ------------------------------------------------------------------ */
/* Team details                                                        */
/* ------------------------------------------------------------------ */

/** Suggestions only; the member may type any role the magazine uses. */
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
  const base = slugify(displayName) || "ekip-uyesi";
  return `${base}-avatar.png`;
}
