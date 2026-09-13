/**
 * The 5651 s. 3 notice is only a notice if the facts are actually in it, so the
 * page has to know what is still blank rather than render a plausible-looking
 * imprint with holes (D-084).
 */
import { describe, expect, it } from "vitest";
import { buildImprint, imprintFields } from "@/lib/legal";
import type { SiteSettings } from "@/services/site-settings";

const complete: SiteSettings = {
  publisher_partner_1: "Elif Yaren Çekiç",
  publisher_partner_2: "Tuanna Demir",
  publisher_address: "Örnek Mah. Örnek Sok. No: 1, İzmir",
  publisher_email: "iletisim@postscriptmag.com",
  public_domain: "www.postscriptmag.com",
  jurisdiction_city: "İzmir",
};

const empty: SiteSettings = {
  publisher_partner_1: null,
  publisher_partner_2: null,
  publisher_address: null,
  publisher_email: null,
  public_domain: null,
  jurisdiction_city: null,
};

describe("buildImprint", () => {
  it("reports nothing missing once every setting is filled", () => {
    const imprint = buildImprint(complete);

    expect(imprint.missing).toEqual([]);
    expect(imprint.partners).toEqual(["Elif Yaren Çekiç", "Tuanna Demir"]);
    expect(imprint.email).toBe("iletisim@postscriptmag.com");
    expect(imprint.jurisdictionCity).toBe("İzmir");
  });

  it("names every blank field when nothing has been saved", () => {
    const imprint = buildImprint(empty);

    expect(imprint.partners).toEqual([]);
    expect(imprint.missing).toEqual([
      "Yayıncı (ortaklar)",
      "Tebligat adresi",
      "E-posta",
      "Alan adı",
      "Yetkili mahkeme",
    ]);
  });

  it("accepts a single partner without calling the publisher missing", () => {
    const imprint = buildImprint({ ...complete, publisher_partner_2: null });

    expect(imprint.partners).toEqual(["Elif Yaren Çekiç"]);
    expect(imprint.missing).toEqual([]);
  });

  it("still flags the address when only that one is blank", () => {
    const imprint = buildImprint({ ...complete, publisher_address: null });

    expect(imprint.missing).toEqual(["Tebligat adresi"]);
  });
});

describe("imprintFields", () => {
  it("lists the identity lines in the order the notice shows them", () => {
    expect(imprintFields(buildImprint(complete))).toEqual([
      { label: "Yayıncı (ortaklar)", value: "Elif Yaren Çekiç, Tuanna Demir" },
      { label: "Tebligat adresi", value: "Örnek Mah. Örnek Sok. No: 1, İzmir" },
      { label: "E-posta", value: "iletisim@postscriptmag.com" },
      { label: "Alan adı", value: "www.postscriptmag.com" },
    ]);
  });

  it("leaves a blank line null so the page can mark it unset", () => {
    const fields = imprintFields(buildImprint(empty));

    expect(fields.map((field) => field.value)).toEqual([null, null, null, null]);
  });
});
