/**
 * The fixed writing areas a writer picks from at registration (D-051).
 *
 * Kept in code rather than the database: the lead module was removed and the
 * owner wants a fixed single-choice list for now. A later iteration can move
 * this into a managed table without changing the form's contract.
 */
export const WRITER_AREAS = [
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

export type WriterArea = (typeof WRITER_AREAS)[number];

/** How many writers each area may hold (D-052). */
export const AREA_QUOTA = 3;

export function isWriterArea(value: string): value is WriterArea {
  return (WRITER_AREAS as readonly string[]).includes(value);
}

export type WriterAreaQuota = {
  name: string;
  currentCount: number;
  full: boolean;
};

/**
 * The area selection rules, pure so they can be unit tested. A full area
 * refuses both the form (disabled radio) and the server. Returns Turkish
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

