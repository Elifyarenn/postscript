import type { MetadataRoute } from "next";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, issues } from "@/db/schema";
import { env } from "@/lib/env";

// Always render per request: a build-time snapshot would ship a stale sitemap
// and would force a database connection during `next build`.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env().APP_URL.replace(/\/+$/, "");
  const now = new Date();

  const [articleRows, issueRows] = await Promise.all([
    db
      .select({ slug: articles.slug, publishedAt: articles.publishedAt })
      .from(articles)
      .where(
        and(
          eq(articles.status, "published"),
          isNull(articles.deletedAt),
          isNotNull(articles.publishedAt),
        ),
      )
      .orderBy(desc(articles.publishedAt)),
    db
      .select({ number: issues.number, publishedAt: issues.publishedAt })
      .from(issues)
      .where(
        and(eq(issues.status, "published"), isNull(issues.deletedAt), isNotNull(issues.publishedAt)),
      )
      .orderBy(desc(issues.publishedAt)),
  ]);

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/magazine`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/magazine/issues`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...articleRows.map((row) => ({
      url: `${baseUrl}/magazine/articles/${row.slug}`,
      lastModified: row.publishedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...issueRows.map((row) => ({
      url: `${baseUrl}/magazine/issues/${row.number}`,
      lastModified: row.publishedAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}