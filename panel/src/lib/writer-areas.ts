/**
 * Writing areas (D-051, D-052, D-055).
 *
 * The areas live in the `writer_areas` table and are managed from the admin
 * panel. This module keeps the pure rules and the default seed set: the list
 * the product launched with, re-inserted by the seed when the table is empty.
 */
export const DEFAULT_WRITER_AREAS = [
  "Bilim & Teknoloji",
  "Psikoloji & İlişkiler",
  "Film, Dizi & Kitap",
  "Sanat & Edebiyat",
  "Pop Culture",
  "Tarih & Dünya",
  "Sosyal & Feminizm",
  "Felsefe & Düşünce",
  "Lifestyle & Fashion",
  "Yazar Köşesi: P.S.",
  "Eğlence & Dedikodu",
] as const;

/**
 * Area names written in English. Uppercased under lang="tr" an English "i"
 * becomes a dotted "İ" ("LİFESTYLE & FASHİON"), so these are marked lang="en"
 * (D-256). Areas are renamed from the admin panel; a new English name that is
 * not listed here only loses the fix, nothing breaks.
 */
const ENGLISH_AREA_NAMES = new Set(["Pop Culture", "Lifestyle & Fashion"]);

export function areaNameLang(name: string): "en" | undefined {
  return ENGLISH_AREA_NAMES.has(name) ? "en" : undefined;
}

/** The quota new areas start with; the seed set uses it too (D-052). */
export const AREA_QUOTA = 3;

export type WriterAreaQuota = {
  name: string;
  quota: number;
  currentCount: number;
  full: boolean;
};

/**
 * The area selection rules, pure so they can be unit tested. A full or unknown
 * area refuses both the form (disabled radio) and the server. Returns Turkish
 * messages; an empty array means the selection is fine.
 */
export function writerAreaSelectionIssues(
  area: string,
  areas: WriterAreaQuota[],
): string[] {
  const found = areas.find((candidate) => candidate.name === area);
  if (!found) return ["Seçilen alan geçersiz."];
  if (found.full) return [`"${found.name}" alanının kontenjanı dolu.`];
  return [];
}