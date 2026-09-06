/**
 * URL slugs.
 *
 * Turkish letters are transliterated explicitly, because the generic Unicode
 * normalisation turns "ı" into "i" only by accident and drops "ğ" entirely.
 */
const TURKISH_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function slugify(input: string): string {
  const transliterated = input.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => TURKISH_MAP[char] ?? char);

  return transliterated
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/**
 * Appends a numeric suffix until the slug is free.
 * `exists` is supplied by the caller so this stays free of database imports.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "yazi";
  if (!(await exists(root))) return root;

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Practically unreachable; a random suffix is still better than a collision
  return `${root}-${Date.now().toString(36)}`;
}
