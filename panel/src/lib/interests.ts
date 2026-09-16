/**
 * The interests a member can put on their community settings (D-149).
 *
 * The settings design draws five chips ("art", "games", "books", "music",
 * "fashion"). The list is fixed rather than free text: a member choosing from
 * a list writes nothing that needs moderating, and the stored value keeps its
 * meaning when a writing area is renamed.
 */

export const INTERESTS = [
  { id: "sanat", label: "sanat" },
  { id: "edebiyat", label: "edebiyat" },
  { id: "muzik", label: "müzik" },
  { id: "film", label: "film" },
  { id: "dizi", label: "dizi" },
  { id: "kitap", label: "kitap" },
  { id: "oyun", label: "oyun" },
  { id: "moda", label: "moda" },
  { id: "bilim", label: "bilim" },
  { id: "tarih", label: "tarih" },
  { id: "psikoloji", label: "psikoloji" },
  { id: "gundem", label: "gündem" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];

/** The design shows five chips in a row; five is also all a profile needs. */
export const MAX_INTERESTS = 5;

const BY_ID = new Map(INTERESTS.map((interest) => [interest.id, interest.label]));

export function isInterestId(value: string): value is InterestId {
  return BY_ID.has(value as InterestId);
}

/** The word shown on the chip, or the stored id if the list ever loses it. */
export function interestLabel(id: string): string {
  return BY_ID.get(id as InterestId) ?? id;
}
