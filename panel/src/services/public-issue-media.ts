/**
 * Published issue pictures served straight from R2 (D-353).
 *
 * Every page picture goes through `/api/issue-pages/:id/media/:mediaId`, a
 * function that reads R2 and hands the bytes on; a miss took 3.3 seconds and
 * the transfer counts against Vercel's free quota. A published issue is the
 * same for everyone, so its pictures can be copies in a separate, public
 * bucket that R2 serves itself.
 *
 * Two switches, off by default:
 *  - `S3_PUBLIC_BUCKET` turns on the copying. Only an issue anyone may open
 *    (`mayReadIssue(null, …)`: published and not admin-only) has copies; the
 *    moment it closes, or a page or picture leaves it, the copies go.
 *  - `PUBLIC_MEDIA_URL` on top turns on the reader using them. Even then a
 *    picture gets its public address only once the manifest says it was
 *    copied; anything else stays on the guarded route, so no image breaks.
 *
 * Removals run inside the change that causes them; additions run after the
 * response and again in the daily run, which also finishes what a short
 * background run left over. The manifest lives in the private bucket.
 */
import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issuePageHotspots, issuePages, issues, media } from "@/db/schema";
import { runInBackground } from "@/lib/background";
import { PUBLIC_PICTURE_SECONDS } from "@/lib/cdn-cache";
import { env } from "@/lib/env";
import { parseBlocks } from "@/lib/issue-blocks";
import { PAGE_VARIANT_WIDTHS, variantName, type PageVariantWidth } from "@/lib/issue-page-variants";
import { getStorage } from "@/lib/storage";
import { mayReadIssue } from "@/lib/issue-access";

export function publicMediaCopying(): boolean {
  return env().S3_PUBLIC_BUCKET !== "";
}

export function publicMediaServing(): boolean {
  return publicMediaCopying() && env().PUBLIC_MEDIA_URL !== "";
}

/** `issues/<issue>/<page>/<media>`, and `….w720` for a smaller copy of a page picture. */
export function publicPictureKey(issueId: string, pageId: string, mediaId: string, width: PageVariantWidth | null = null): string {
  const key = `issues/${issueId}/${pageId}/${mediaId}`;
  return width ? `${key}.w${width}` : key;
}

function manifestKey(issueId: string): string {
  return `public-manifests/${issueId}.json`;
}

/** One object the public bucket should hold, and where its bytes come from. */
type Wanted = { key: string; picture: string; sourceKey: string; fallbackKey: string; mime: string; fallbackMime: string };

async function wantedObjects(issueId: string): Promise<Wanted[]> {
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue || !mayReadIssue(null, issue)) return [];

  const pages = await db
    .select({ id: issuePages.id, imageMediaId: issuePages.imageMediaId, blocks: issuePages.blocks })
    .from(issuePages)
    .where(eq(issuePages.issueId, issueId));
  const areas = pages.length
    ? await db
        .select({ pageId: issuePageHotspots.pageId, mediaId: issuePageHotspots.infoMediaId })
        .from(issuePageHotspots)
        .where(and(inArray(issuePageHotspots.pageId, pages.map((page) => page.id)), isNotNull(issuePageHotspots.infoMediaId)))
    : [];

  // The same pictures the guarded route agrees to serve (`pageUsesMedia`); only
  // the page picture itself has smaller copies
  const uses: { pageId: string; mediaId: string; variants: boolean }[] = [];
  for (const page of pages) {
    if (page.imageMediaId) uses.push({ pageId: page.id, mediaId: page.imageMediaId, variants: true });
    for (const block of parseBlocks(page.blocks)) {
      if (block.kind === "zoom" && block.mediaId) uses.push({ pageId: page.id, mediaId: block.mediaId, variants: false });
      if (block.kind === "gallery") for (const id of block.mediaIds) uses.push({ pageId: page.id, mediaId: id, variants: false });
    }
  }
  for (const area of areas) if (area.mediaId) uses.push({ pageId: area.pageId, mediaId: area.mediaId, variants: false });
  if (uses.length === 0) return [];

  const rows = await db
    .select({ id: media.id, storageKey: media.storageKey, mime: media.mime })
    .from(media)
    .where(and(inArray(media.id, [...new Set(uses.map((use) => use.mediaId))]), isNull(media.deletedAt)));
  const byId = new Map(rows.map((row) => [row.id, row]));

  const wanted: Wanted[] = [];
  for (const use of uses) {
    const row = byId.get(use.mediaId);
    if (!row) continue;
    const picture = publicPictureKey(issueId, use.pageId, use.mediaId);
    if (use.variants) {
      for (const width of PAGE_VARIANT_WIDTHS) {
        // A picture without a stored smaller copy answers with the original, as the route does
        const copy = variantName(row.storageKey, width);
        wanted.push({
          key: publicPictureKey(issueId, use.pageId, use.mediaId, width),
          picture,
          sourceKey: copy ?? row.storageKey,
          fallbackKey: row.storageKey,
          mime: copy ? "image/webp" : row.mime,
          fallbackMime: row.mime,
        });
      }
    }
    // The original last: once it is listed, its copies are there too
    wanted.push({ key: picture, picture, sourceKey: row.storageKey, fallbackKey: row.storageKey, mime: row.mime, fallbackMime: row.mime });
  }
  return wanted;
}

async function readManifest(issueId: string): Promise<Set<string>> {
  try {
    const body = await getStorage().get({ bucket: "media", key: manifestKey(issueId) });
    const parsed = JSON.parse(body.toString("utf8")) as { pictures?: unknown };
    return new Set(Array.isArray(parsed.pictures) ? parsed.pictures.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

async function writeManifest(issueId: string, pictures: Set<string>): Promise<void> {
  const body = Buffer.from(JSON.stringify({ pictures: [...pictures].sort(), at: new Date().toISOString() }));
  await getStorage().put({ bucket: "media", key: manifestKey(issueId), body, mime: "application/json" });
  manifestCache.set(issueId, { at: Date.now(), pictures });
}

export type PublicMediaSync = { added: number; removed: number; pending: number };

/**
 * Brings one issue's public copies in line with what may be public now.
 * Removals always run and come first; additions stop at the time budget and
 * report what is left for the next run.
 */
export async function reconcilePublicIssueMedia(
  issueId: string,
  { add = true, budgetMs = 40_000 }: { add?: boolean; budgetMs?: number } = {},
): Promise<PublicMediaSync | null> {
  if (!publicMediaCopying()) return null;
  const storage = getStorage();
  const wanted = await wantedObjects(issueId);
  const wantedKeys = new Set(wanted.map((item) => item.key));
  const existing = new Set(await storage.list({ bucket: "public", prefix: `issues/${issueId}/` }));

  // Readers stop being pointed at a copy before the copy goes
  const manifest = await readManifest(issueId);
  const listed = new Set([...manifest].filter((picture) => wantedKeys.has(picture)));
  if (listed.size !== manifest.size) await writeManifest(issueId, listed);

  let removed = 0;
  for (const key of existing) {
    if (wantedKeys.has(key)) continue;
    await storage.remove({ bucket: "public", key });
    existing.delete(key);
    removed += 1;
  }

  let added = 0;
  let pending = 0;
  if (add) {
    const deadline = Date.now() + budgetMs;
    const pictures = new Map<string, Wanted[]>();
    for (const item of wanted) pictures.set(item.picture, [...(pictures.get(item.picture) ?? []), item]);

    let changed = false;
    for (const [picture, items] of pictures) {
      if (listed.has(picture) && items.every((item) => existing.has(item.key))) continue;
      if (Date.now() > deadline) {
        pending += 1;
        continue;
      }
      for (const item of items) {
        if (existing.has(item.key)) continue;
        const copy = await storage.get({ bucket: "media", key: item.sourceKey }).catch(() => null);
        const body = copy ?? (await storage.get({ bucket: "media", key: item.fallbackKey }));
        await storage.put({
          bucket: "public",
          key: item.key,
          body,
          mime: copy ? item.mime : item.fallbackMime,
          // The browser keeps it as long as it keeps the guarded route's answer (D-308)
          cacheControl: `public, max-age=${PUBLIC_PICTURE_SECONDS}`,
        });
        existing.add(item.key);
        added += 1;
      }
      listed.add(picture);
      changed = true;
    }
    if (changed) await writeManifest(issueId, listed);
  }

  return { added, removed, pending };
}

/**
 * After anything that can change which pictures an issue shows publicly: the
 * removals now, the additions once the response is sent. A failure is logged
 * and left to the daily run; the guarded route is unaffected either way.
 */
export async function afterIssuePicturesChanged(issueId: string): Promise<void> {
  if (!publicMediaCopying()) return;
  try {
    await reconcilePublicIssueMedia(issueId, { add: false });
  } catch (error) {
    console.error(`[public-media] removal for issue ${issueId} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await runInBackground(async () => {
    await reconcilePublicIssueMedia(issueId);
  });
}

/** The daily run: every issue, removals first everywhere, then additions within the budget. */
export async function reconcileAllPublicMedia(budgetMs = 120_000): Promise<PublicMediaSync | null> {
  if (!publicMediaCopying()) return null;
  const rows = await db.select({ id: issues.id }).from(issues);
  const total: PublicMediaSync = { added: 0, removed: 0, pending: 0 };
  for (const row of rows) {
    const result = await reconcilePublicIssueMedia(row.id, { add: false });
    total.removed += result?.removed ?? 0;
  }
  const deadline = Date.now() + budgetMs;
  for (const row of rows) {
    const result = await reconcilePublicIssueMedia(row.id, { budgetMs: Math.max(0, deadline - Date.now()) });
    total.added += result?.added ?? 0;
    total.pending += result?.pending ?? 0;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* The reader's side                                                   */
/* ------------------------------------------------------------------ */

/** A function instance reads the manifest at most once a minute per issue. */
const manifestCache = new Map<string, { at: number; pictures: Set<string> }>();
const MANIFEST_SECONDS = 60;

/**
 * The public address of a picture when it may and does have one, otherwise
 * null and the caller keeps the guarded route.
 */
export async function publicPictureResolver(
  issue: { id: string; status: Parameters<typeof mayReadIssue>[1]["status"]; adminOnly: boolean },
): Promise<(pageId: string, mediaId: string) => string | null> {
  if (!publicMediaServing() || !mayReadIssue(null, issue)) return () => null;
  let entry = manifestCache.get(issue.id);
  if (!entry || Date.now() - entry.at > MANIFEST_SECONDS * 1000) {
    entry = { at: Date.now(), pictures: await readManifest(issue.id) };
    manifestCache.set(issue.id, entry);
  }
  const { pictures } = entry;
  const base = env().PUBLIC_MEDIA_URL;
  return (pageId, mediaId) => {
    const key = publicPictureKey(issue.id, pageId, mediaId);
    return pictures.has(key) ? `${base}/${key}` : null;
  };
}

/** Only for tests: forget the cached manifests. */
export function resetPublicManifestCache(): void {
  manifestCache.clear();
}
