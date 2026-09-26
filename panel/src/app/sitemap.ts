import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Only pages a logged-out visitor can open (D-252).
 *
 * Everything under /magazine sits behind the session gate (D-035), so its
 * URLs answer with a redirect to /login; listing them told search engines to
 * index the login page. When reading opens without a session, add the
 * published issues and articles back here (with `admin_only = false`, D-240).
 * Static pages carry no lastModified: a value that changes on every request
 * teaches crawlers to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = env().SITE_URL.replace(/\/+$/, "");

  return [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/hakkinda`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/kategoriler`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/iletisim`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/kunye`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/kvkk`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/kullanim-sartlari`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
