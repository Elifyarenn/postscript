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

export function isWriterArea(value: string): value is WriterArea {
  return (WRITER_AREAS as readonly string[]).includes(value);
}
