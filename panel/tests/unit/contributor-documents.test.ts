/**
 * The contributor documents' rules (D-276): the templates are the delivered
 * texts word for word, and nothing the records do not hold is filled in.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import * as mupdf from "mupdf";
import { describe, expect, it } from "vitest";
import { AgreementRenderError, extractPlaceholders, fillTemplate } from "@/lib/agreement/render";
import {
  ADAPTATION_SCOPE_TEXT,
  CONTRIBUTOR_AGREEMENT_FILE,
  contributionRoleLabel,
  DELIVERED_LICENCE_FORM_FILE,
  LICENCE_FORM_FILE,
  LICENCE_GROUP_FORM_FILE,
  licenceFormValues,
  reasonForPlaceholder,
  wordCount,
} from "@/lib/contributor-documents";

const contracts = (file: string) => path.join(process.cwd(), "contracts", file);

/** Only whitespace, list marks and markdown syntax are ignored; every word counts. */
function comparable(text: string): string {
  return text.replace(/[\s#*|•·_\-–]/g, "").replace(/’/g, "'");
}

function pdfText(file: string): string {
  const doc = mupdf.Document.openDocument(readFileSync(contracts(path.join("kaynak", file))), "application/pdf");
  let text = "";
  for (let index = 0; index < doc.countPages(); index++) {
    // Each page repeats the header and its number; they are not part of the text
    text += doc
      .loadPage(index)
      .toStructuredText("preserve-whitespace")
      .asText()
      .replace(/^\s*POSTSCRIPT DERGİSİ\s*\n\s*\d+\s*\n/, "");
  }
  return text;
}

/**
 * The only change made to the delivered text (D-280): the magazine is party
 * through Fatma Tuanna Demir, and the partnership wording is gone. Everything
 * else must still match the PDF word for word.
 */
const PARTY_CHANGES: [before: string, after: string][] = [
  [
    "Dergi: Postscript Dergisi (Postscript Dergisi adı altında faaliyet gösteren adi ortaklık adına ortaklar: {{dergi.ortak_1}}, {{dergi.ortak_2}}. Ortaklardan her biri Dergi adına tek başına temsile yetkilidir. Tebligat",
    "Dergi: PostScript Dergisi adına Fatma Tuanna Demir (Tebligat",
  ],
  [
    "Ruhsat alan (Dergi): Postscript Dergisi (Postscript Dergisi adı altında faaliyet gösteren adi ortaklık adına ortaklar: {{dergi.ortak_1}}, {{dergi.ortak_2}}. Ortaklardan her biri Dergi adına tek başına temsile yetkilidir. Adres",
    "Ruhsat alan (Dergi): PostScript Dergisi adına Fatma Tuanna Demir (Adres",
  ],
  ["Postscript Dergisi adına yetkili Ad Soyad: ________________________", "PostScript Dergisi adına Ad Soyad: Fatma Tuanna Demir"],
  ["Ruhsat alan (Postscript Dergisi adına) Ad Soyad: ______________________", "Ruhsat alan (PostScript Dergisi adına) Ad Soyad: Fatma Tuanna Demir"],
];

/** Applied on the comparable form, so line breaks in the PDF do not matter. */
function withPartyChange(pdf: string): string {
  let text = comparable(pdf);
  for (const [before, after] of PARTY_CHANGES) text = text.replace(comparable(before), comparable(after));
  return text;
}

describe("the templates are the delivered documents", () => {
  it.each([
    [CONTRIBUTOR_AGREEMENT_FILE, "01-genel-katki-saglayan-sozlesmesi-ISLAK-IMZA-DIJITAL.pdf"],
    [DELIVERED_LICENCE_FORM_FILE, "02-eser-bazli-kullanim-ruhsati-formu-DIJITAL-GUNCEL.pdf"],
  ])("%s says word for word what the PDF says, but for the party change of D-280", (template, pdf) => {
    expect(comparable(readFileSync(contracts(template), "utf8"))).toBe(withPartyChange(pdfText(pdf)));
  });

  it("keeps both signature blocks: the contributor and the magazine", () => {
    for (const file of [CONTRIBUTOR_AGREEMENT_FILE, DELIVERED_LICENCE_FORM_FILE, LICENCE_FORM_FILE, LICENCE_GROUP_FORM_FILE]) {
      const text = readFileSync(contracts(file), "utf8");
      expect(text).toMatch(/PostScript Dergisi adına\)?\n\nAd Soyad: Fatma Tuanna Demir/);
      expect(text).toMatch(/Katkı Sağlayan \/ Eser Sahibi/);
    }
  });

  it("names Fatma Tuanna Demir for the magazine, with no partnership wording left", () => {
    for (const file of [CONTRIBUTOR_AGREEMENT_FILE, DELIVERED_LICENCE_FORM_FILE, LICENCE_FORM_FILE, LICENCE_GROUP_FORM_FILE]) {
      const text = readFileSync(contracts(file), "utf8");
      expect(text).toMatch(/: PostScript Dergisi adına Fatma Tuanna Demir\n/);
      expect(text).not.toMatch(/adi ortaklık|ortaklar:|Ortaklardan|tek başına temsil|dergi\.ortak_/);
    }
  });
});

describe("the licence forms in use (D-340)", () => {
  const forms = [LICENCE_FORM_FILE, LICENCE_GROUP_FORM_FILE].map((file) => readFileSync(contracts(file), "utf8"));
  /** The delivered text's articles by number, for what D-340 left alone. */
  const articles = (text: string) =>
    Object.fromEntries(text.split(/\n(?=## )/).map((part) => [part.split("\n")[0], comparable(part)]));

  it("names each commercial use it allows, and what stays outside", () => {
    for (const text of forms) {
      expect(text).toContain("(a) Ücretli basılı dergi:");
      expect(text).toContain("(b) Ücretli dijital dergi ve abonelik:");
      expect(text).toContain("(c) Reklam gelirleri:");
      expect(text).toContain("(d) Sponsorluk:");
      expect(text).toContain("7.2. \"Dahil\" olsa da şunlar bu formun kapsamı dışındadır");
      expect(text).toContain("Ticari kullanım\n{{form.commercial_use_label}}");
      expect(text).toContain("Basılı Sayı (ücretli veya ücretsiz) · {{form.channel_print}}");
      expect(text).toContain("Ücretli dijital Sayı, tekil satın alma ve abonelik · {{form.channel_paid_digital}}");
    }
  });

  it("keeps the licence free even with commercial use, with no share of the income", () => {
    for (const text of forms) {
      expect(text).toContain("Ruhsat, Madde 7'de ticari kullanım \"Dahil\" olarak gösterildiğinde de bedelsizdir.");
      expect(text).toMatch(/telif ücreti, gelir payı, kâr payı veya başka bir ödeme hakkı doğurmaz ve bu yönde yorumlanamaz/);
    }
  });

  it("is in force on both signatures; the panel only archives and checks", () => {
    for (const text of forms) {
      expect(text).toContain("## 12. Şekil, İmza ve Yürürlük");
      expect(text).toMatch(/12\.2\. Ruhsat, bu formun Katkı Sağlayan ve PostScript Dergisi adına Fatma Tuanna Demir tarafından imzalanmasıyla yürürlüğe girer/);
      expect(text).toMatch(/12\.3\. Dergi yöneticisinin onayı, Panel'de bir durumun değiştirilmesi.* yürürlük şartı değildir/);
      expect(text).toMatch(/12\.4\. İmzalı formun taranmış kopyasının Panel'e yüklenmesi yalnızca arşivleme ve .* doğrulanması amacını taşır/);
      expect(text).not.toMatch(/"imzalandı" olarak işaretlediğinde/);
    }
  });

  it("leaves every other article of the delivered form as it was", () => {
    const delivered = articles(readFileSync(contracts(DELIVERED_LICENCE_FORM_FILE), "utf8"));
    const current = articles(forms[0]!);
    const changed = ["## 3. Ruhsat Kapsamındaki Mali Haklar", "## 4. Mecralar", "## 5. Süre ve Yer", "## 6. Bedel", "## 7. Ticari Kullanım", "## 8. Ad Gösterimi ve Ruhsatın Devamı", "## 12. Şekil"];
    for (const [heading, text] of Object.entries(delivered)) {
      if (heading.startsWith("# POSTSCRIPT") || changed.includes(heading)) continue;
      expect(current[heading], heading).toBe(text);
    }
  });
});

describe("contributionRoleLabel", () => {
  it("names what the records say and nothing more", () => {
    expect(contributionRoleLabel({ role: "writer", isIllustrator: false })).toBe("Yazar");
    expect(contributionRoleLabel({ role: "user", isIllustrator: true })).toBe("Çizer");
    expect(contributionRoleLabel({ role: "writer", isIllustrator: true })).toBe("Yazar ve Çizer");
    expect(contributionRoleLabel({ role: "editor", isIllustrator: false, hasWorks: true })).toBe("Yazar");
    expect(contributionRoleLabel({ role: "editor", isIllustrator: false })).toBeNull();
  });
});

describe("licenceFormValues", () => {
  const terms = {
    grantType: "non_exclusive_license",
    rightReproduction: true,
    rightDistribution: true,
    rightCommunicationToPublic: true,
    rightAdaptation: true,
    channels: ["web", "pdf_issue", "social", "newsletter"],
    territory: "worldwide",
    exclusivityMonths: null,
    commercialUseIncluded: false,
  };

  it("fills what the fixed scope states", () => {
    const values = licenceFormValues({ terms, bylineChoice: "pen_name", displayName: "Ad Soyad", penName: "Mahlas" });
    expect(values["form.grant_type_label"]).toBe("Basit ruhsat (FSEK m. 56/1)");
    expect(values["form.channel_newsletter"]).toBe("Evet");
    expect(values["form.commercial_use_label"]).toBe("Hariç");
    expect(values["form.channel_print"]).toBe("Hayır");
    expect(values["form.channel_paid_digital"]).toBe("Hayır");
    expect(values["form.byline_label"]).toBe("Mahlasıyla (Mahlas)");
  });

  it("opens the print and paid channels only with commercial use (D-340)", () => {
    const values = licenceFormValues({ terms: { ...terms, commercialUseIncluded: true }, bylineChoice: null, displayName: "Ad Soyad", penName: null });
    expect(values["form.commercial_use_label"]).toBe("Dahil");
    expect(values["form.channel_print"]).toBe("Evet");
    expect(values["form.channel_paid_digital"]).toBe("Evet");
  });

  it("fills the magazine's fixed period and adaptation limit", () => {
    const values = licenceFormValues({ terms, bylineChoice: null, displayName: "Ad Soyad", penName: null });
    expect(values["form.duration_label"]).toBe(
      "FSEK uyarınca ilgili mali hakkın geçerli koruma süresi boyunca",
    );
    expect(values["form.adaptation_scope"]).toBe(ADAPTATION_SCOPE_TEXT);
    expect(ADAPTATION_SCOPE_TEXT).toMatch(/^Eserin özünü, anlamını .* bu kapsamda değildir\.$/);
    expect(licenceFormValues({ terms: { ...terms, rightAdaptation: false }, bylineChoice: null, displayName: "Ad Soyad", penName: null })["form.adaptation_scope"]).toBe("—");
  });

  it("names the author by name when no byline was chosen (D-284)", () => {
    const values = licenceFormValues({ terms, bylineChoice: null, displayName: "Ad Soyad", penName: "Mahlas" });
    expect(values["form.byline_label"]).toBe("Gerçek adıyla (Ad Soyad)");
    expect(
      licenceFormValues({ terms, bylineChoice: "real_name", displayName: "Ad Soyad", penName: "Mahlas" })["form.byline_label"],
    ).toBe("Gerçek adıyla (Ad Soyad)");
  });

  it("does not print a pen name that does not exist; the name stands in", () => {
    const values = licenceFormValues({ terms, bylineChoice: "pen_name", displayName: "Ad Soyad", penName: null });
    expect(values["form.byline_label"]).toBe("Gerçek adıyla (Ad Soyad)");
  });
});

describe("the licence form never leaves a hole", () => {
  it("names every value it could not fill", () => {
    const template = readFileSync(contracts(LICENCE_FORM_FILE), "utf8");
    const values = Object.fromEntries(extractPlaceholders(template).map((name) => [name, "x"]));
    values["form.duration_label"] = null as unknown as string;

    try {
      fillTemplate(template, values);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AgreementRenderError);
      expect((error as AgreementRenderError).placeholders).toEqual(["form.duration_label"]);
      expect(reasonForPlaceholder("form.duration_label")).toBe("Ruhsat süresi sistemde tanımlı değil");
    }
  });
});

describe("wordCount", () => {
  it("counts words, not markdown", () => {
    expect(wordCount("# Başlık\n\nBir **iki** üç. [dört](https://x.y) — 5")).toBe(6);
    expect(wordCount("   ")).toBe(0);
  });
});
