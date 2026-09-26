import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Panels, accounts and one-time links (D-252). The pages also carry
        // noindex; this keeps crawlers from spending their visits on them.
        // /magazine and /social stay crawlable so share previews keep working
        // if reading is ever opened up without a session.
        disallow: [
          "/admin",
          "/editor",
          "/writer",
          "/writer-application",
          "/account",
          "/api/",
          "/login/2fa",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${env().SITE_URL.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
