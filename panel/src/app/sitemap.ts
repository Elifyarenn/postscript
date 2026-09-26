import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listPublicAuthors, listPublishedIssues, listSitemapArticles } from "@/services/public";

// Always render per request: a build-time snapshot would ship a stale sitemap
// and would force a database connection during `next build`.
export const dynamic = "force-dynamic";

/**
 * Every page a logged-out visitor can open (D-252, D-257): the static pages,
 * the magazine, and each published issue, article and author page. The lists
 * come from the public read models, so a draft, a scheduled article or the
 * admins' working issue can never appear here. Static pages carry no
 * lastModified: a value that changes on every request teaches crawlers to
 * ignore it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env().SITE_URL.replace(/\/+$/, "");

  const [issues, articles, authors] = await Promise.all([
    listPublishedIssues(),
    listSitemapArticles(),
    listPublicAuthors(),
  ]);

  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/magazine`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/magazine/issues`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/hakkinda`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/kategoriler`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/iletisim`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/kunye`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/kvkk`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/kullanim-sartlari`, changeFrequency: "yearly", priority: 0.3 },
    ...issues.map((issue) => ({
      url: `${baseUrl}/magazine/issues/${issue.number}`,
      ...(issue.publishedAt ? { lastModified: issue.publishedAt } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...articles.map((article) => ({
      url: `${baseUrl}/magazine/articles/${article.slug}`,
      ...(article.lastModified ? { lastModified: article.lastModified } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...authors.map((author) => ({
      url: `${baseUrl}/magazine/authors/${author.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
