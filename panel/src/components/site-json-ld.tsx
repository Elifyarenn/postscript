/**
 * Organization and WebSite structured data for the front page (D-252).
 *
 * "Postscript" is a common name for publications; this tells search engines
 * which one this is: a Turkish-language magazine published from Türkiye.
 * Only facts the site already states are used; an empty setting is left out.
 */
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { SOCIAL_LINKS } from "@/lib/site";
import type { SiteSettings } from "@/services/site-settings";

export function buildSiteJsonLd(siteUrl: string, settings: SiteSettings) {
  const url = siteUrl.replace(/\/+$/, "") + "/";
  const organizationId = `${url}#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_NAME,
        url,
        ...(settings.publisher_email ? { email: settings.publisher_email } : {}),
        // The künye names İzmir; the street address is not settled yet
        address: { "@type": "PostalAddress", addressCountry: "TR" },
        // Accounts without an address yet are left out
        sameAs: SOCIAL_LINKS.flatMap((link) => (link.url ? [link.url] : [])),
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: SITE_NAME,
        url,
        description: SITE_DESCRIPTION,
        inLanguage: "tr-TR",
        publisher: { "@id": organizationId },
      },
    ],
  };
}

export function SiteJsonLd({ siteUrl, settings }: { siteUrl: string; settings: SiteSettings }) {
  // "<" escaped so a value can never close the script element
  const json = JSON.stringify(buildSiteJsonLd(siteUrl, settings)).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
