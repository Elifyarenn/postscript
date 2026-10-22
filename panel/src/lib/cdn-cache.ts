/**
 * The shared (CDN) cache for a published issue's page pictures (D-343).
 *
 * A picture of a published issue is the same for everyone, so Vercel's CDN may
 * keep it and answer without running a function: the function took about a
 * second per picture and every page turn waited for it. Every cached answer
 * carries two tags, its issue's and its page's, and closing either deletes the
 * copies at once: an issue taken off the air is closed to everyone (D-317), a
 * page taken out of an issue is gone (a removal request, 5651 m. 9).
 *
 * A reader's own browser keeps a copy for an hour (D-308); the CDN keeps it a
 * day (D-352), so a purge that fails can leave a closed picture on the CDN for
 * no longer than that.
 */
import "server-only";
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { refreshPublicPages } from "@/lib/revalidate";

/** How long a reader's browser may keep a published picture, in seconds. */
export const PUBLIC_PICTURE_SECONDS = 3600;

/**
 * How long the CDN may keep it (D-352). The bytes under a media id never
 * change and every closing purges by tag, so the CDN can keep a picture far
 * longer than a browser, which nothing can purge. A day is the ceiling because
 * a purge can fail: the copy left behind then still goes within the 24 hours
 * 5651 m. 9 gives a removal.
 */
export const CDN_PICTURE_SECONDS = 86_400;

export function issueCacheTag(issueId: string): string {
  return `issue-${issueId}`;
}

export function pageCacheTag(pageId: string): string {
  return `issue-page-${pageId}`;
}

/** The headers of a picture everyone may see: kept by the browser and the CDN, tagged for purging. */
export function publicPictureHeaders(issueId: string, pageId: string): Record<string, string> {
  return {
    "cache-control": `public, max-age=${PUBLIC_PICTURE_SECONDS}`,
    "vercel-cdn-cache-control": `max-age=${CDN_PICTURE_SECONDS}`,
    "vercel-cache-tag": `${issueCacheTag(issueId)},${pageCacheTag(pageId)}`,
  };
}

/**
 * Deletes every cached copy carrying one of the tags. Outside Vercel there is
 * no CDN to purge. A failure is logged and swallowed: the change it follows
 * has already been made, and the hour above bounds what is left.
 */
export async function forgetCachedPictures(tags: string[]): Promise<void> {
  // The issue's cached pages name the pictures, so they go with them (D-351)
  refreshPublicPages();
  if (!process.env.VERCEL) return;
  // Vercel takes at most 16 tags in one purge
  for (let from = 0; from < tags.length; from += 16) {
    const batch = tags.slice(from, from + 16);
    try {
      await dangerouslyDeleteByTag(batch);
    } catch (error) {
      console.error(`CDN purge failed for ${batch.join(", ")}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
