/**
 * The publisher details 5651 s. 3 requires a site to show (D-084).
 *
 * The values live in `site_settings`, where an admin edits them for the writer
 * contract. The statutory notice needs exactly the same facts, so it reads the
 * same rows rather than keeping a second copy that could drift.
 *
 * Nothing here touches the database: the page fetches the settings and hands
 * them over, so this stays a pure function and can be tested on its own.
 */
import type { SiteSettings } from "@/services/site-settings";

export type ImprintField = {
  /** What the notice calls this line. */
  label: string;
  value: string | null;
};

export type Imprint = {
  /** The partners, in order, with blanks dropped. */
  partners: string[];
  address: string | null;
  email: string | null;
  domain: string | null;
  jurisdictionCity: string | null;
  /**
   * Labels of the fields an admin has not filled in yet. The notice is
   * incomplete until this is empty, and the page says so rather than
   * rendering a convincing-looking notice with holes in it.
   */
  missing: string[];
};

const LABELS = {
  partners: "Yayıncı (ortaklar)",
  address: "Tebligat adresi",
  email: "E-posta",
  domain: "Alan adı",
  jurisdictionCity: "Yetkili mahkeme",
} as const;

export function buildImprint(settings: SiteSettings): Imprint {
  const partners = [settings.publisher_partner_1, settings.publisher_partner_2].filter(
    (partner): partner is string => Boolean(partner),
  );

  const imprint: Imprint = {
    partners,
    address: settings.publisher_address,
    email: settings.publisher_email,
    domain: settings.public_domain,
    jurisdictionCity: settings.jurisdiction_city,
    missing: [],
  };

  // Two partners are expected; one is enough to name the publisher, none is not
  if (partners.length === 0) imprint.missing.push(LABELS.partners);
  if (!imprint.address) imprint.missing.push(LABELS.address);
  if (!imprint.email) imprint.missing.push(LABELS.email);
  if (!imprint.domain) imprint.missing.push(LABELS.domain);
  if (!imprint.jurisdictionCity) imprint.missing.push(LABELS.jurisdictionCity);

  return imprint;
}

/** The identity lines, in the order the notice shows them. */
export function imprintFields(imprint: Imprint): ImprintField[] {
  return [
    { label: LABELS.partners, value: imprint.partners.join(", ") || null },
    { label: LABELS.address, value: imprint.address },
    { label: LABELS.email, value: imprint.email },
    { label: LABELS.domain, value: imprint.domain },
  ];
}
