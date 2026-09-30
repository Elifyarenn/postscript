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
  LICENCE_FORM_FILE,
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
    [LICENCE_FORM_FILE, "02-eser-bazli-kullanim-ruhsati-formu-DIJITAL-GUNCEL.pdf"],
  ])("%s says word for word what the PDF says, but for the party change of D-280", (template, pdf) => {
    expect(comparable(readFileSync(contracts(template), "utf8"))).toBe(withPartyChange(pdfText(pdf)));
  });

  it("keeps both signature blocks: the contributor and the magazine", () => {
    for (const file of [CONTRIBUTOR_AGREEMENT_FILE, LICENCE_FORM_FILE]) {
      const text = readFileSync(contracts(file), "utf8");
      expect(text).toMatch(/PostScript Dergisi adına\)?\n\nAd Soyad: Fatma Tuanna Demir/);
      expect(text).toMatch(/Katkı Sağlayan \/ Eser Sahibi/);
    }
  });

  it("names Fatma Tuanna Demir for the magazine, with no partnership wording left", () => {
    for (const file of [CONTRIBUTOR_AGREEMENT_FILE, LICENCE_FORM_FILE]) {
      const text = readFileSync(contracts(file), "utf8");
      expect(text).toMatch(/: PostScript Dergisi adına Fatma Tuanna Demir\n/);
      expect(text).not.toMatch(/adi ortaklık|ortaklar:|Ortaklardan|tek başına temsil|dergi\.ortak_/);
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
    expect(values["form.byline_label"]).toBe("Mahlasıyla (Mahlas)");
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

  it("leaves an unchosen byline unfilled", () => {
    const values = licenceFormValues({ terms, bylineChoice: null, displayName: "Ad Soyad", penName: null });
    expect(values["form.byline_label"]).toBeNull();
    expect(
      licenceFormValues({ terms, bylineChoice: "real_name", displayName: "Ad Soyad", penName: "Mahlas" })["form.byline_label"],
    ).toBe("Gerçek adıyla (Ad Soyad)");
  });

  it("does not print a pen name that does not exist", () => {
    const values = licenceFormValues({ terms, bylineChoice: "pen_name", displayName: "Ad Soyad", penName: null });
    expect(values["form.byline_label"]).toBeNull();
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
