/**
 * Search and share metadata (D-252).
 */
import { describe, expect, it } from "vitest";
import { pageMetadata, SHARE_IMAGE, SITE_NAME } from "@/lib/seo";
import { buildSiteJsonLd } from "@/components/site-json-ld";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

const SETTINGS = {
  publisher_partner_1: "Ortak Bir",
  publisher_partner_2: null,
  publisher_address: "Konak, İzmir",
  publisher_email: "iletisim@example.com",
  public_domain: "postscriptmag.com",
  jurisdiction_city: "İzmir",
};

describe("pageMetadata", () => {
  it("gives a page its own canonical, description and full share set", () => {
    const meta = pageMetadata({ title: "Künye", description: "Açıklama", path: "/kunye" });
    expect(meta.title).toBe("Künye");
    expect(meta.alternates?.canonical).toBe("/kunye");
    expect(meta.openGraph).toMatchObject({
      title: `${SITE_NAME} - Künye`,
      description: "Açıklama",
      url: "/kunye",
      locale: "tr_TR",
      siteName: SITE_NAME,
      images: [SHARE_IMAGE],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", site: "@postscriptmgzn" });
  });

  it("leaves the title to the root default on the front page", () => {
    const meta = pageMetadata({ path: "/" });
    expect(meta.title).toBeUndefined();
    expect(meta.openGraph?.title).toBe(SITE_NAME);
  });
});

describe("buildSiteJsonLd", () => {
  it("describes a Turkish-language publication from Türkiye", () => {
    const json = buildSiteJsonLd("https://www.postscriptmag.com/", SETTINGS);
    const [organization, website] = json["@graph"];
    expect(organization).toMatchObject({
      "@type": "Organization",
      url: "https://www.postscriptmag.com/",
      email: "iletisim@example.com",
      address: { addressCountry: "TR" },
    });
    expect(organization).toHaveProperty("sameAs", expect.arrayContaining(["https://x.com/postscriptmgzn"]));
    expect(website).toMatchObject({ "@type": "WebSite", inLanguage: "tr-TR" });
  });

  it("leaves out an e-mail that has not been set", () => {
    const json = buildSiteJsonLd("https://www.postscriptmag.com", { ...SETTINGS, publisher_email: null });
    expect(json["@graph"][0]).not.toHaveProperty("email");
  });
});

describe("sitemap and robots", () => {
  it("lists only pages a logged-out visitor can open", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(urls).toContain("/kvkk");
    expect(urls.some((path) => path.startsWith("/magazine"))).toBe(false);
  });

  it("keeps crawlers out of the panels but not out of the magazine", () => {
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules[0]! : rules).disallow;
    expect(disallow).toContain("/admin");
    expect(disallow).not.toContain("/magazine");
  });
});
