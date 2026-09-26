/**
 * Search and share metadata for the public pages (D-252).
 *
 * Next.js replaces a parent's `openGraph` object wholesale when a page sets
 * its own, so every page builds the full set here instead of relying on the
 * root layout's values being inherited.
 */
import type { Metadata } from "next";
import { socialUrl } from "@/lib/site";

export const SITE_NAME = "PostScript Dergi"; // D-046

// Everything in it is stated on the site: kâr amacı gütmeyen (künye), Turkish,
// and the fields of the earlier site description
export const SITE_DESCRIPTION =
  "PostScript Dergi, edebiyat, psikoloji ve kültür üzerine yazılar yayımlayan, kâr amacı gütmeyen Türkçe bir e-dergi.";

const X_HANDLE = "@" + (socialUrl("x")?.split("/").pop() ?? "postscriptmgzn");

/** The generated site image (src/app/opengraph-image.tsx). */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — Türkçe e-dergi`,
};

export function pageMetadata(options: {
  /** Short title; the root layout's template adds the site name. */
  title?: string;
  description?: string;
  /** Canonical path, starting with "/". */
  path: string;
  /** An article's share card also says when it came out and who wrote it (D-257). */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    /** Author page paths or URLs. */
    authors?: string[];
    section?: string;
  };
}): Metadata {
  const description = options.description ?? SITE_DESCRIPTION;
  const fullTitle = options.title ? `${SITE_NAME} - ${options.title}` : SITE_NAME;

  return {
    ...(options.title ? { title: options.title } : {}),
    description,
    alternates: { canonical: options.path },
    openGraph: {
      ...(options.article ? { type: "article" as const, ...options.article } : { type: "website" as const }),
      locale: "tr_TR",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: options.path,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: X_HANDLE,
      title: fullTitle,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}

/** For pages that must stay out of search: sign-in, panels, member areas. */
export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };
