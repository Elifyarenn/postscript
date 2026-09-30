/**
 * The contributor documents' rules (D-276), pure so they are unit tested and
 * the service, the pages and the tests read them from one place.
 *
 * Every value that goes into a document comes from a record. What the records
 * do not say is not filled in: the document is kept as `needs_review` with the
 * reason, and nobody guesses a birth date, a byline or a licence period.
 */
import type { ArticleStatus, Role } from "@/db/schema";

/** The licence form as delivered (contracts/eser-bazli-kullanim-ruhsati-formu.md). */
export const LICENCE_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu.md";
export const LICENCE_FORM_TEMPLATE_VERSION = "1";

/** The contributor contract as delivered; the current version must be this text. */
export const CONTRIBUTOR_AGREEMENT_FILE = "genel-katki-saglayan-sozlesmesi.md";

export type ContributorDocumentKind = "general_agreement" | "work_licence";

export const DOCUMENT_KIND_LABELS: Record<ContributorDocumentKind, string> = {
  general_agreement: "Genel Katkı Sağlayan Sözleşmesi",
  work_licence: "Eser Bazlı Kullanım Ruhsatı Formu",
};

export const DOCUMENT_STATUS_LABELS = {
  prepared: "Hazır",
  needs_review: "İnceleme gerekiyor",
} as const;

/**
 * "Rol / katkı türü" from what the account's records say: the writer role or
 * an authored work makes a Yazar, the çizer mark (D-151) a Çizer. Nothing
 * else is inferred; an account with neither is not a contributor.
 */
export function contributionRoleLabel(input: {
  role: Role;
  isIllustrator: boolean;
  hasWorks?: boolean;
}): string | null {
  const labels: string[] = [];
  if (input.role === "writer" || input.hasWorks) labels.push("Yazar");
  if (input.isIllustrator) labels.push("Çizer");
  return labels.length > 0 ? labels.join(" ve ") : null;
}

/**
 * The statuses in which the magazine has accepted a text. The form speaks of
 * "Dergi tarafından kabul edilen … eser"; a draft or a text still in review
 * is not that yet, and a withdrawn one no longer is.
 */
export const ACCEPTED_WORK_STATUSES: readonly ArticleStatus[] = [
  "ready_for_publishing",
  "accepted",
  "awaiting_rights",
  "scheduled",
  "published",
  "archived",
];

/** Words in a markdown body, for the form's technical description. */
export function wordCount(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ");
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * The licence scope as the code fixes it today (`LICENCE_TERMS`, rights.ts).
 * Only what it states is turned into the form's labels.
 */
export type LicenceTerms = {
  grantType: string;
  rightReproduction: boolean;
  rightDistribution: boolean;
  rightCommunicationToPublic: boolean;
  rightAdaptation: boolean;
  channels: readonly string[];
  territory: string;
  exclusivityMonths: number | null;
  commercialUseIncluded: boolean;
};

const GRANT_TYPE_LABELS: Record<string, string> = {
  non_exclusive_license: "Basit ruhsat (FSEK m. 56/1)",
  exclusive_license: "Tam ruhsat (FSEK m. 56/2)",
};

const TERRITORY_LABELS: Record<string, string> = { worldwide: "Tüm dünya" };

const yesNo = (value: boolean) => (value ? "Evet" : "Hayır");

/** The licence period, as the magazine fixed it (D-277). */
export const LICENCE_DURATION_TEXT = "FSEK uyarınca ilgili mali hakkın geçerli koruma süresi boyunca";

/** The written limit of the adaptation right, as the magazine fixed it (D-277). */
export const ADAPTATION_SCOPE_TEXT =
  "Eserin özünü, anlamını ve eser sahibinin hususiyetini değiştirmemek kaydıyla; dergi sayfa düzenine ve dijital yayın formatlarına uyarlanması için gerekli kırpma, boyutlandırma, yerleşim ve teknik format düzenlemeleriyle sınırlıdır. Çeviri, dramatizasyon, seslendirme veya eserin başka bir eser türüne dönüştürülmesi bu kapsamda değildir.";

/**
 * The form's `form.*` values. The ones the records cannot supply come back
 * null, and the render then names them as the reason for review. The period
 * and the adaptation limit are the magazine's fixed texts (D-277); the byline
 * is known only when the author chose it for this work, and is never guessed.
 */
export function licenceFormValues(input: {
  terms: LicenceTerms;
  bylineChoice: "real_name" | "pen_name" | null;
  displayName: string;
  penName: string | null;
}): Record<string, string | null> {
  const { terms } = input;
  const byline =
    input.bylineChoice === "real_name"
      ? `Gerçek adıyla (${input.displayName})`
      : input.bylineChoice === "pen_name" && input.penName
        ? `Mahlasıyla (${input.penName})`
        : null;

  return {
    "form.grant_type_label": GRANT_TYPE_LABELS[terms.grantType] ?? null,
    "form.right_reproduction": yesNo(terms.rightReproduction),
    "form.right_distribution": yesNo(terms.rightDistribution),
    "form.right_communication_to_public": yesNo(terms.rightCommunicationToPublic),
    "form.right_adaptation": yesNo(terms.rightAdaptation),
    "form.adaptation_scope": terms.rightAdaptation ? ADAPTATION_SCOPE_TEXT : "—",
    "form.channel_web": yesNo(terms.channels.includes("web")),
    "form.channel_pdf_issue": yesNo(terms.channels.includes("pdf_issue")),
    "form.channel_social": yesNo(terms.channels.includes("social")),
    "form.channel_newsletter": yesNo(terms.channels.includes("newsletter")),
    "form.territory_label": TERRITORY_LABELS[terms.territory] ?? null,
    "form.duration_label": LICENCE_DURATION_TEXT,
    "form.exclusivity_label":
      terms.grantType === "exclusive_license"
        ? terms.exclusivityMonths
          ? `${terms.exclusivityMonths} ay`
          : null
        : "Uygulanmaz (basit ruhsat)",
    "form.commercial_use_label": terms.commercialUseIncluded ? "Dahil" : "Hariç",
    "form.byline_label": byline,
  };
}

/** Plain Turkish for the placeholders a review is waiting on. */
const PLACEHOLDER_REASONS: Record<string, string> = {
  "form.duration_label": "Ruhsat süresi sistemde tanımlı değil",
  "form.adaptation_scope": "İşleme hakkının yazılı kapsamı sistemde tanımlı değil",
  "form.byline_label": "Bu eser için yayın adı tercihi (gerçek ad / mahlas) kayıtlı değil",
  "form.grant_type_label": "Ruhsat türü tanınmadı",
  "form.territory_label": "Ruhsat yeri tanınmadı",
  "form.exclusivity_label": "Tam ruhsat için münhasırlık süresi kayıtlı değil",
  "katki.dogum_tarihi": "Doğum tarihi kayıtlı değil",
  "katki.rol": "Katkı türü kayıtlardan belirlenemedi",
  "katki.ad_soyad": "Ad soyad kayıtlı değil",
  "katki.eposta": "E-posta kayıtlı değil",
  "dergi.adres": "Dergi tebligat adresi (Sistem ayarları) boş",
  "dergi.ortak_1": "Dergi ortağı 1 adı (Sistem ayarları) boş",
  "dergi.ortak_2": "Dergi ortağı 2 adı (Sistem ayarları) boş",
  "dergi.eposta": "Dergi e-postası (Sistem ayarları) boş",
  "dergi.domain": "Dergi alan adı (Sistem ayarları) boş",
  "dergi.sehir": "Yetkili mahkeme şehri (Sistem ayarları) boş",
  "kvkk.version": "Yayımlanmış KVKK aydınlatma metni sürümü yok",
  "agreement.published_at": "Sözleşme sürümü yayımlanmamış",
};

export function reasonForPlaceholder(name: string): string {
  return PLACEHOLDER_REASONS[name] ?? `Eksik alan: ${name}`;
}
