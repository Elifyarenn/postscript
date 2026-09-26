/**
 * Structured data: Organization and WebSite for the front page (D-252), and
 * Article for a published article (D-257).
 *
 * "Postscript" is a common name for publications; this tells search engines
 * which one this is: a Turkish-language magazine published from Türkiye.
 * Only facts the site already states are used; an empty setting is left out.
 */
import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
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

/** Any structured data block; "<" escaped so a value can never close the script element. */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function SiteJsonLd({ siteUrl, settings }: { siteUrl: string; settings: SiteSettings }) {
  return <JsonLd data={buildSiteJsonLd(siteUrl, settings)} />;
}

/**
 * Article data for a published article (D-257). The publisher points at the
 * Organization on the front page by its @id; the author is the byline the
 * article is actually published under (D-076), never a legal name.
 */
export function buildArticleJsonLd(
  siteUrl: string,
  article: {
    title: string;
    slug: string;
    summary: string | null;
    category: string | null;
    publishedAt: Date | null;
    updatedAt: Date | null;
    issueNumber: number | null;
    author: { name: string; slug: string | null } | null;
  },
) {
  const base = siteUrl.replace(/\/+$/, "");
  const url = `${base}/magazine/articles/${article.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    ...(article.summary ? { description: article.summary } : {}),
    url,
    mainEntityOfPage: url,
    inLanguage: "tr-TR",
    ...(article.publishedAt ? { datePublished: article.publishedAt.toISOString() } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt.toISOString() } : {}),
    ...(article.category ? { articleSection: article.category } : {}),
    image: `${base}${SHARE_IMAGE.url}`,
    ...(article.author
      ? {
          author: {
            "@type": "Person",
            name: article.author.name,
            ...(article.author.slug ? { url: `${base}/magazine/authors/${article.author.slug}` } : {}),
          },
        }
      : {}),
    publisher: { "@id": `${base}/#organization` },
    ...(article.issueNumber !== null
      ? {
          isPartOf: {
            "@type": "PublicationIssue",
            issueNumber: String(article.issueNumber),
            url: `${base}/magazine/issues/${article.issueNumber}`,
          },
        }
      : {}),
  };
}
