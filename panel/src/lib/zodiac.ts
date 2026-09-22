/**
 * The twelve signs, for the team form (D-226).
 *
 * The stored ids are English like every other enum in the schema; only the
 * labels are Turkish, in the order the signs are usually listed.
 */
export const ZODIAC_SIGNS = [
  { id: "aries", label: "Koç" },
  { id: "taurus", label: "Boğa" },
  { id: "gemini", label: "İkizler" },
  { id: "cancer", label: "Yengeç" },
  { id: "leo", label: "Aslan" },
  { id: "virgo", label: "Başak" },
  { id: "libra", label: "Terazi" },
  { id: "scorpio", label: "Akrep" },
  { id: "sagittarius", label: "Yay" },
  { id: "capricorn", label: "Oğlak" },
  { id: "aquarius", label: "Kova" },
  { id: "pisces", label: "Balık" },
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number]["id"];

export const ZODIAC_IDS = ZODIAC_SIGNS.map((sign) => sign.id) as [ZodiacSign, ...ZodiacSign[]];

export function zodiacLabel(id: string | null): string | null {
  return ZODIAC_SIGNS.find((sign) => sign.id === id)?.label ?? null;
}

/** How the team page should name someone (D-226); never the article byline. */
export const TEAM_BYLINE_LABELS: Record<string, string> = {
  real_name: "Adım",
  pen_name: "Mahlasım",
};

/**
 * The name that choice actually resolves to, so the admin reads the name the
 * team page will carry rather than only the preference (D-229). Null when the
 * choice has no name behind it — a pen name that was never set.
 */
export function teamBylineName(
  choice: string | null,
  person: { displayName: string; penName: string | null },
): string | null {
  if (choice === "real_name") return person.displayName;
  if (choice === "pen_name") return person.penName;
  return null;
}

/** The longest a member's line may be, as the product owner set it. */
export const MOTTO_MAX = 55;
