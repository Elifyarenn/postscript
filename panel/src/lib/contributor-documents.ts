/**
 * The contributor documents' rules (D-276), pure so they are unit tested and
 * the service, the pages and the tests read them from one place.
 *
 * Every value that goes into a document comes from a record. What the records
 * do not say is not filled in: the document is kept as `needs_review` with the
 * reason, and nobody guesses a birth date, a byline or a licence period.
 */
import type { Role } from "@/db/schema";
import { countWords } from "./word-count";

/**
 * The licence form as delivered (contracts/eser-bazli-kullanim-ruhsati-formu.md,
 * template version 1). Forms are no longer drawn from it; the unit test keeps
 * it equal to the delivered PDF, the base every later version is read against.
 */
export const DELIVERED_LICENCE_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu.md";

/**
 * The single-work form in use: version 1 with the commercial uses spelled out
 * and the licence in force on both signatures, not on the panel (D-340,
 * version 3), changed only by both parties in writing (D-341, version 5), and
 * covering the editors' corrections until publication, signed in counterparts
 * and initialled on every page (D-358, version 7).
 */
export const LICENCE_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu-v7.md";
export const LICENCE_FORM_TEMPLATE_VERSION = "7";

/**
 * The same form for every work an author gave one issue (D-339): section 1
 * lists the works, the rest of the text applies to each of them. Used when an
 * author has more than one work in the issue; a single work keeps the form
 * above. Version 2 was the D-339 text, version 4 added D-340, version 6 D-341,
 * version 8 D-358.
 */
export const LICENCE_GROUP_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu-v8.md";
export const LICENCE_GROUP_TEMPLATE_VERSION = "8";

/**
 * The same two forms for a çizer's drawings (D-372): versions 7 and 8 with
 * section 1 naming the uploaded file and without the editors' text
 * corrections, which a drawing has no counterpart of. A çizer's drawings in
 * one issue share the issue form, apart from any text works of theirs.
 * Versions 11 and 12 (D-382) keep the text of 9 and 10 word for word; they
 * name each drawing by its record ("Çizim 2790166d") instead of the çizer's
 * own title, and the new number makes the unsent older forms drawn again.
 */
export const ILLUSTRATION_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu-cizim-v11.md";
export const ILLUSTRATION_FORM_TEMPLATE_VERSION = "11";
export const ILLUSTRATION_GROUP_FORM_FILE = "eser-bazli-kullanim-ruhsati-formu-cizim-v12.md";
export const ILLUSTRATION_GROUP_TEMPLATE_VERSION = "12";

/** "PNG, 2480 × 3508 piksel, 3,2 MB": what section 1 says of an uploaded drawing's file. */
export function illustrationFileDescription(file: {
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}): string {
  const format = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP" }[file.mime] ?? file.mime;
  const pixels = file.width && file.height ? `, ${file.width} × ${file.height} piksel` : "";
  const megabytes = (file.size / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return `Panel'e yüklenen çizim dosyası: ${format}${pixels}, ${megabytes} MB`;
}

/**
 * Whether new licence forms include commercial use (D-340): one
 * `site_settings` row the admin sets, "included" or "excluded". Without the
 * row the forms say "Hariç", which grants nothing beyond the free channels.
 */
export const LICENCE_COMMERCIAL_SETTING = "licence_commercial_use";

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

/** Words in a markdown body, for the form's technical description: the panels' count (D-330). */
export const wordCount = countWords;

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
 * is the author's own choice for the work, or their name when there is none
 * (D-284).
 */
export function licenceFormValues(input: {
  terms: LicenceTerms;
  bylineChoice: "real_name" | "pen_name" | null;
  displayName: string;
  penName: string | null;
}): Record<string, string | null> {
  const { terms } = input;
  // Without a usable choice the form names the author by name (D-284)
  const byline =
    input.bylineChoice === "pen_name" && input.penName
      ? `Mahlasıyla (${input.penName})`
      : input.displayName.trim()
        ? `Gerçek adıyla (${input.displayName})`
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
    // The print and paid channels exist only with commercial use (D-340, form article 7)
    "form.channel_print": yesNo(terms.commercialUseIncluded),
    "form.channel_paid_digital": yesNo(terms.commercialUseIncluded),
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
  "sayi.ad": "Eserlerin sayısı kayıtlı değil",
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
