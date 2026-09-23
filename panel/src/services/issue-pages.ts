import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  issuePageHotspots,
  issuePages,
  issueQuizzes,
  issues,
  media,
  users,
  type Issue,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { parseBlocks, issuePageBlocksSchema, type PageBlock } from "@/lib/issue-blocks";
import {
  hotspotIsReady,
  hotspotListSchema,
  safeExternalUrl,
  type HotspotKind,
  type ReaderHotspot,
} from "@/lib/issue-hotspots";
import { imageSize, sameAspect } from "@/lib/image-size";
import { parseQuestions, stripAnswers, type ReaderQuiz } from "@/lib/issue-quiz";
import { PAGE_TEMPLATE_IDS, templateOf } from "@/lib/issue-templates";
import { detectFileType } from "./media";
import { buildStorageKey, getStorage } from "@/lib/storage";
import type { RequestMeta } from "./auth";

/**
 * The pages of an issue (D-234, reshaped by D-240).
 *
 * A page is a designed picture with clickable areas drawn on top of it. The
 * picture carries the headline, the words and the illustration, exactly as the
 * designer delivered them; what the panel adds is where a reader may press and
 * what happens when they do.
 *
 * The older template pages (D-234) still work and are still rendered: a page
 * with no picture falls back to its layout, so nothing already typed is lost.
 *
 * Who may see what is decided here, not in a page component. `readIssuePages`
 * is the one door the reader route goes through, so an unpublished issue
 * cannot leak through a share link, a search or the page's own data — and an
 * issue marked `adminOnly` is closed to everyone but an admin, including
 * editors and writers.
 */

export type PageArticle = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  authorName: string | null;
  /** The body is only carried when the article may actually be read. */
  body: string | null;
};

export type HotspotView = ReaderHotspot & { ready: boolean };

export type IssuePageView = {
  id: string;
  position: number;
  template: string;
  tocTitle: string | null;
  inContents: boolean;
  heading: string | null;
  standfirst: string | null;
  byline: string | null;
  body: string | null;
  caption: string | null;
  section: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  label: string | null;
  transcript: string | null;
  blocks: PageBlock[];
  hotspots: HotspotView[];
  article: PageArticle | null;
};

export type IssueReader = {
  issue: {
    id: string;
    number: number;
    title: string;
    theme: string | null;
    blurb: string | null;
    status: string;
    adminOnly: boolean;
    publishedAt: Date | null;
  };
  pages: IssuePageView[];
  quizzes: ReaderQuiz[];
  /** True when the reader is looking at something not yet published. */
  preview: boolean;
};

/**
 * Page pictures are served through the page, not through the media library:
 * the route re-asks whether this actor may open this issue, so a picture from
 * a closed issue is a 404 even to someone who knows its media id.
 */
export function pageMediaUrl(pageId: string, mediaId: string): string {
  return `/api/issue-pages/${pageId}/media/${mediaId}`;
}

const pageColumns = {
  id: issuePages.id,
  position: issuePages.position,
  template: issuePages.template,
  tocTitle: issuePages.tocTitle,
  inContents: issuePages.inContents,
  heading: issuePages.heading,
  standfirst: issuePages.standfirst,
  byline: issuePages.byline,
  body: issuePages.body,
  caption: issuePages.caption,
  section: issuePages.section,
  blocks: issuePages.blocks,
  imageMediaId: issuePages.imageMediaId,
  imageWidth: issuePages.imageWidth,
  imageHeight: issuePages.imageHeight,
  pageAlt: issuePages.imageAlt,
  label: issuePages.label,
  transcript: issuePages.transcript,
  mediaAlt: media.altText,
  articleId: issuePages.articleId,
  articleTitle: articles.title,
  articleSlug: articles.slug,
  articleStatus: articles.status,
  articleBody: articles.bodyMarkdown,
  articleSummary: articles.summary,
  authorName: users.penName,
};

/** An article's own words belong to the reader only once it is published. */
function articleOf(row: Record<string, unknown>, preview: boolean): PageArticle | null {
  const id = row.articleId as string | null;
  if (!id) return null;
  const status = (row.articleStatus as string | null) ?? "draft";
  const readable = status === "published";
  return {
    id,
    title: (row.articleTitle as string | null) ?? "",
    slug: readable ? ((row.articleSlug as string | null) ?? null) : null,
    status,
    authorName: (row.authorName as string | null) ?? null,
    // In the panel's preview an editor may read what they are laying out; a
    // reader may not, because an unpublished article is not theirs yet
    body: readable || preview ? ((row.articleBody as string | null) ?? null) : null,
  };
}

type HotspotRow = typeof issuePageHotspots.$inferSelect;

function hotspotView(row: HotspotRow): HotspotView {
  return {
    id: row.id,
    kind: row.kind as HotspotKind,
    name: row.name,
    ariaLabel: row.ariaLabel,
    showMarker: row.showMarker,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    // Re-checked on the way out as well as on the way in: a link that was
    // valid when saved must still be http or https when it is handed over
    url: row.kind === "link" ? safeExternalUrl(row.url ?? "") : null,
    openInNewTab: row.openInNewTab,
    targetPageId: row.targetPageId,
    infoTitle: row.infoTitle,
    infoBody: row.infoBody,
    infoImageUrl: row.infoMediaId ? pageMediaUrl(row.pageId, row.infoMediaId) : null,
    quizId: row.quizId,
    ready: hotspotIsReady({
      kind: row.kind as HotspotKind,
      url: row.url,
      targetPageId: row.targetPageId,
      infoTitle: row.infoTitle,
      infoBody: row.infoBody,
      quizId: row.quizId,
    }),
  };
}

function toView(
  row: Record<string, unknown>,
  hotspots: HotspotView[],
  preview: boolean,
): IssuePageView {
  const id = row.id as string;
  const imageMediaId = row.imageMediaId as string | null;
  return {
    id,
    position: row.position as number,
    template: row.template as string,
    tocTitle: (row.tocTitle as string | null) ?? null,
    inContents: row.inContents as boolean,
    heading: (row.heading as string | null) ?? null,
    standfirst: (row.standfirst as string | null) ?? null,
    byline: (row.byline as string | null) ?? null,
    body: (row.body as string | null) ?? null,
    caption: (row.caption as string | null) ?? null,
    section: (row.section as string | null) ?? null,
    imageUrl: imageMediaId ? pageMediaUrl(id, imageMediaId) : null,
    imageAlt: ((row.pageAlt as string | null) ?? (row.mediaAlt as string | null)) ?? null,
    imageWidth: (row.imageWidth as number | null) ?? null,
    imageHeight: (row.imageHeight as number | null) ?? null,
    label: (row.label as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    blocks: parseBlocks(row.blocks),
    hotspots,
    article: articleOf(row, preview),
  };
}

async function pagesOf(issueId: string, preview: boolean): Promise<IssuePageView[]> {
  const rows = await db
    .select(pageColumns)
    .from(issuePages)
    .leftJoin(media, eq(issuePages.imageMediaId, media.id))
    .leftJoin(articles, eq(issuePages.articleId, articles.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(eq(issuePages.issueId, issueId))
    .orderBy(asc(issuePages.position));

  const ids = rows.map((row) => row.id);
  const areas = ids.length
    ? await db
        .select()
        .from(issuePageHotspots)
        .where(inArray(issuePageHotspots.pageId, ids))
        .orderBy(asc(issuePageHotspots.position))
    : [];

  const byPage = new Map<string, HotspotView[]>();
  for (const area of areas) {
    const list = byPage.get(area.pageId) ?? [];
    list.push(hotspotView(area));
    byPage.set(area.pageId, list);
  }

  return rows.map((row) =>
    toView(row as Record<string, unknown>, byPage.get(row.id) ?? [], preview),
  );
}

/* ------------------------------------------------------------------ */
/* The one door                                                        */
/* ------------------------------------------------------------------ */

/**
 * Whether this actor may open this issue at all.
 *
 *  - an issue marked `adminOnly` is the admins' working copy: nobody else,
 *    not an editor, not a writer, not a signed-in reader (D-240)
 *  - a published issue is open to any signed-in reader
 *  - anything else is the editorial panel's preview
 */
export function mayReadIssue(actor: Actor | null, issue: Pick<Issue, "status" | "adminOnly">): boolean {
  if (issue.adminOnly) return actor !== null && canAccessAdminPanel(actor);
  if (issue.status === "published" || issue.status === "archived") return actor !== null;
  return actor !== null && canAccessEditorPanel(actor);
}

/** True when this actor is looking at something not yet published. */
function isPreview(issue: Pick<Issue, "status">): boolean {
  return issue.status !== "published" && issue.status !== "archived";
}

async function issueByNumber(number: number): Promise<Issue> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.number, number), isNull(issues.deletedAt)))
    .limit(1);
  const issue = rows[0];
  if (!issue) throw notFound("Sayı bulunamadı.");
  return issue;
}

async function issueById(issueId: string): Promise<Issue> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  const issue = rows[0];
  if (!issue) throw notFound("Sayı bulunamadı.");
  return issue;
}

/**
 * The reader's view of an issue. Everyone the door turns away gets a 404 —
 * the same answer a missing issue gives, so nothing is confirmed to exist.
 */
export async function readIssuePages(actor: Actor | null, number: number): Promise<IssueReader> {
  const issue = await issueByNumber(number);
  if (!mayReadIssue(actor, issue)) throw notFound("Sayı bulunamadı.");

  const preview = isPreview(issue);
  const [pages, quizRows] = await Promise.all([
    pagesOf(issue.id, preview),
    db.select().from(issueQuizzes).where(eq(issueQuizzes.issueId, issue.id)),
  ]);

  // An unfinished area is left out rather than shown dead
  const readable = pages.map((page) => ({
    ...page,
    hotspots: page.hotspots.filter((area) => area.ready),
  }));

  // Only the quizzes a page actually opens. A quiz nobody can reach from this
  // issue's pages is not part of the reader's copy of it.
  const reachable = new Set(
    readable.flatMap((page) =>
      page.hotspots.flatMap((area) => (area.quizId ? [area.quizId] : [])),
    ),
  );

  return {
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      theme: issue.theme,
      blurb: issue.blurb,
      status: issue.status,
      adminOnly: issue.adminOnly,
      publishedAt: issue.publishedAt,
    },
    pages: readable,
    // Without their answer keys: `correct` and `points` never leave the server
    quizzes: quizRows
      .filter((row) => reachable.has(row.id))
      .map((row) =>
        stripAnswers({
          id: row.id,
          kind: row.kind,
          title: row.title,
          intro: row.intro,
          questions: parseQuestions(row.questions),
        }),
      ),
    preview,
  };
}

/** The panel's view: every page of an issue, whatever its state. */
export async function listIssuePages(actor: Actor, issueId: string): Promise<IssuePageView[]> {
  const issue = await issueById(issueId);
  if (!canAccessEditorPanel(actor) || !mayReadIssue(actor, issue)) throw forbidden();
  return pagesOf(issue.id, true);
}

/**
 * The bytes of a picture that belongs to a page, for the guarded media route.
 *
 * Two questions, both of which must pass: may this actor open the issue, and
 * does this page genuinely use this picture? The second stops the route being
 * a way to read the whole media library through a page the caller can see.
 */
export async function readPageMedia(
  actor: Actor | null,
  pageId: string,
  mediaId: string,
): Promise<{ mime: string; body: Buffer }> {
  const rows = await db
    .select({ page: issuePages, issue: issues })
    .from(issuePages)
    .innerJoin(issues, eq(issuePages.issueId, issues.id))
    .where(eq(issuePages.id, pageId))
    .limit(1);
  const found = rows[0];
  if (!found || found.issue.deletedAt) throw notFound("Sayfa bulunamadı.");
  if (!mayReadIssue(actor, found.issue)) throw notFound("Sayfa bulunamadı.");

  const used = await pageUsesMedia(found.page, mediaId);
  if (!used) throw notFound("Görsel bulunamadı.");

  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row || row.deletedAt) throw notFound("Görsel bulunamadı.");

  return { mime: row.mime, body: await getStorage().get({ bucket: "media", key: row.storageKey }) };
}

async function pageUsesMedia(page: typeof issuePages.$inferSelect, mediaId: string): Promise<boolean> {
  if (page.imageMediaId === mediaId) return true;

  const blocks = parseBlocks(page.blocks);
  const inBlocks = blocks.some((block) => {
    if (block.kind === "zoom") return block.mediaId === mediaId;
    if (block.kind === "gallery") return block.mediaIds.includes(mediaId);
    return false;
  });
  if (inBlocks) return true;

  const area = await db
    .select({ id: issuePageHotspots.id })
    .from(issuePageHotspots)
    .where(and(eq(issuePageHotspots.pageId, page.id), eq(issuePageHotspots.infoMediaId, mediaId)))
    .limit(1);
  return area.length > 0;
}

/* ------------------------------------------------------------------ */
/* Laying an issue out (admin)                                         */
/* ------------------------------------------------------------------ */

function assertLayoutRight(actor: Actor): void {
  // Issue planning is the admin's, as it has been since D-059
  if (!canAccessAdminPanel(actor)) throw forbidden("Sayı hazırlama yalnızca yöneticinindir.");
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const pageInputSchema = z.strictObject({
  template: z.enum(PAGE_TEMPLATE_IDS),
  tocTitle: optionalText(200),
  inContents: z.boolean().optional(),
  heading: optionalText(300),
  standfirst: optionalText(600),
  byline: optionalText(200),
  body: optionalText(20_000),
  caption: optionalText(400),
  section: optionalText(120),
  imageMediaId: z.uuid().nullable().optional(),
  articleId: z.uuid().nullable().optional(),
  blocks: issuePageBlocksSchema.optional(),
});

/** What the page list edits about an uploaded picture; the design is untouched. */
export const pageMetaSchema = z.strictObject({
  label: optionalText(120),
  imageAlt: optionalText(400),
  transcript: optionalText(20_000),
  tocTitle: optionalText(200),
  inContents: z.boolean().optional(),
  /** `cover`, `back_cover` or `full_bleed` — what this picture is in the issue. */
  template: z.enum(["cover", "back_cover", "full_bleed"]).optional(),
});

async function nextPosition(issueId: string): Promise<number> {
  const [row] = await db
    .select({ last: sql<number>`coalesce(max(${issuePages.position}), 0)` })
    .from(issuePages)
    .where(eq(issuePages.issueId, issueId));
  return (row?.last ?? 0) + 1;
}

export async function addIssuePage(
  actor: Actor,
  issueId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<string> {
  assertLayoutRight(actor);
  const parsed = pageInputSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Sayfa bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);

  const template = templateOf(parsed.data.template);
  const [created] = await db
    .insert(issuePages)
    .values({
      issueId,
      position: await nextPosition(issueId),
      template: parsed.data.template,
      inContents: parsed.data.inContents ?? template.inContentsByDefault,
      tocTitle: parsed.data.tocTitle ?? null,
      heading: parsed.data.heading ?? null,
      standfirst: parsed.data.standfirst ?? null,
      byline: parsed.data.byline ?? null,
      body: parsed.data.body ?? null,
      caption: parsed.data.caption ?? null,
      section: parsed.data.section ?? null,
      imageMediaId: parsed.data.imageMediaId ?? null,
      articleId: parsed.data.articleId ?? null,
      blocks: parsed.data.blocks ?? [],
    })
    .returning({ id: issuePages.id });

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.added",
    entityType: "issue_pages",
    entityId: created!.id,
    after: { issueId, template: parsed.data.template },
    ip: meta.ip,
  });
  return created!.id;
}

export async function updateIssuePage(
  actor: Actor,
  pageId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  assertLayoutRight(actor);
  const parsed = pageInputSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Sayfa bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);

  const updated = await db
    .update(issuePages)
    .set({
      template: parsed.data.template,
      inContents: parsed.data.inContents ?? true,
      tocTitle: parsed.data.tocTitle ?? null,
      heading: parsed.data.heading ?? null,
      standfirst: parsed.data.standfirst ?? null,
      byline: parsed.data.byline ?? null,
      body: parsed.data.body ?? null,
      caption: parsed.data.caption ?? null,
      section: parsed.data.section ?? null,
      imageMediaId: parsed.data.imageMediaId ?? null,
      articleId: parsed.data.articleId ?? null,
      blocks: parsed.data.blocks ?? [],
      updatedAt: new Date(),
    })
    .where(eq(issuePages.id, pageId))
    .returning({ id: issuePages.id, issueId: issuePages.issueId });

  if (!updated[0]) throw notFound("Sayfa bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.updated",
    entityType: "issue_pages",
    entityId: pageId,
    after: { template: parsed.data.template },
    ip: meta.ip,
  });
}

/** The fields the page list edits: the label, the alt text and what it is. */
export async function updatePageMeta(
  actor: Actor,
  pageId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  assertLayoutRight(actor);
  const parsed = pageMetaSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Sayfa bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);

  const updated = await db
    .update(issuePages)
    .set({
      label: parsed.data.label ?? null,
      imageAlt: parsed.data.imageAlt ?? null,
      transcript: parsed.data.transcript ?? null,
      tocTitle: parsed.data.tocTitle ?? null,
      inContents: parsed.data.inContents ?? false,
      ...(parsed.data.template ? { template: parsed.data.template } : {}),
      updatedAt: new Date(),
    })
    .where(eq(issuePages.id, pageId))
    .returning({ id: issuePages.id });

  if (!updated[0]) throw notFound("Sayfa bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.meta_updated",
    entityType: "issue_pages",
    entityId: pageId,
    after: { template: parsed.data.template ?? null },
    ip: meta.ip,
  });
}

export async function removeIssuePage(actor: Actor, pageId: string, meta: RequestMeta): Promise<void> {
  assertLayoutRight(actor);
  const removed = await db
    .delete(issuePages)
    .where(eq(issuePages.id, pageId))
    .returning({ id: issuePages.id, issueId: issuePages.issueId });
  const row = removed[0];
  if (!row) throw notFound("Sayfa bulunamadı.");

  await renumber(row.issueId);
  await writeAudit({
    actorId: actor.id,
    action: "issue_page.removed",
    entityType: "issue_pages",
    entityId: pageId,
    before: { issueId: row.issueId },
    ip: meta.ip,
  });
}

export async function duplicateIssuePage(actor: Actor, pageId: string, meta: RequestMeta): Promise<string> {
  assertLayoutRight(actor);
  const rows = await db.select().from(issuePages).where(eq(issuePages.id, pageId)).limit(1);
  const source = rows[0];
  if (!source) throw notFound("Sayfa bulunamadı.");

  const [created] = await db
    .insert(issuePages)
    .values({
      issueId: source.issueId,
      position: await nextPosition(source.issueId),
      template: source.template,
      inContents: source.inContents,
      tocTitle: source.tocTitle,
      heading: source.heading,
      standfirst: source.standfirst,
      byline: source.byline,
      body: source.body,
      caption: source.caption,
      section: source.section,
      imageMediaId: source.imageMediaId,
      imageWidth: source.imageWidth,
      imageHeight: source.imageHeight,
      label: source.label,
      imageAlt: source.imageAlt,
      transcript: source.transcript,
      // The copy starts unlinked: two pages claiming the same article in the
      // contents would be a mistake more often than not
      articleId: null,
      blocks: source.blocks,
    })
    .returning({ id: issuePages.id });

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.duplicated",
    entityType: "issue_pages",
    entityId: created!.id,
    after: { from: pageId },
    ip: meta.ip,
  });
  return created!.id;
}

/** Closes the gaps a removal leaves, so positions stay 1..n. */
async function renumber(issueId: string): Promise<void> {
  const rows = await db
    .select({ id: issuePages.id })
    .from(issuePages)
    .where(eq(issuePages.issueId, issueId))
    .orderBy(asc(issuePages.position));

  await applyOrder(
    issueId,
    rows.map((row) => row.id),
  );
}

/**
 * Writes an order out. Everything is pushed out of the way first, because the
 * unique index on (issue, position) would fight a direct renumbering.
 */
async function applyOrder(issueId: string, order: string[]): Promise<void> {
  await db
    .update(issuePages)
    .set({ position: sql`${issuePages.position} + 10000` })
    .where(eq(issuePages.issueId, issueId));

  for (const [index, pageId] of order.entries()) {
    await db.update(issuePages).set({ position: index + 1 }).where(eq(issuePages.id, pageId));
  }
}

/** Moves one page up or down by a single step. */
export async function moveIssuePage(
  actor: Actor,
  pageId: string,
  direction: "up" | "down",
  meta: RequestMeta,
): Promise<void> {
  assertLayoutRight(actor);
  const rows = await db.select().from(issuePages).where(eq(issuePages.id, pageId)).limit(1);
  const page = rows[0];
  if (!page) throw notFound("Sayfa bulunamadı.");

  const siblings = await db
    .select({ id: issuePages.id })
    .from(issuePages)
    .where(eq(issuePages.issueId, page.issueId))
    .orderBy(asc(issuePages.position));

  const index = siblings.findIndex((row) => row.id === pageId);
  const target = direction === "up" ? index - 1 : index + 1;
  // Already at the edge: nothing to do, and no error either
  if (target < 0 || target >= siblings.length) return;

  const order = siblings.map((row) => row.id);
  const [moved] = order.splice(index, 1);
  order.splice(target, 0, moved!);
  await applyOrder(page.issueId, order);

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.moved",
    entityType: "issue_pages",
    entityId: pageId,
    after: { direction },
    ip: meta.ip,
  });
}

/**
 * The whole order at once, as dragging a list produces it. Every page of the
 * issue must be named exactly once: a partial order would leave the rest
 * somewhere arbitrary, which is worse than refusing.
 */
export async function reorderIssuePages(
  actor: Actor,
  issueId: string,
  order: string[],
  meta: RequestMeta,
): Promise<void> {
  assertLayoutRight(actor);
  const rows = await db
    .select({ id: issuePages.id })
    .from(issuePages)
    .where(eq(issuePages.issueId, issueId));

  const known = new Set(rows.map((row) => row.id));
  const asked = new Set(order);
  if (asked.size !== order.length || asked.size !== known.size || order.some((id) => !known.has(id))) {
    throw badRequest("Sıralama listesi sayının sayfalarıyla eşleşmiyor.");
  }

  await applyOrder(issueId, order);
  await writeAudit({
    actorId: actor.id,
    action: "issue_page.reordered",
    entityType: "issues",
    entityId: issueId,
    after: { count: order.length },
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Page pictures                                                       */
/* ------------------------------------------------------------------ */

/** What the panel takes as a designed page. GIF is not among them. */
const PAGE_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"];

/**
 * Larger than the library's ten (D-240): a full page of design at a size
 * where the small type is still readable is a big file, and squeezing it to
 * fit the library's limit is exactly what must not happen to it.
 */
export const MAX_PAGE_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * The bytes decide the type, not the name the browser sent. Every refusal
 * says what is wrong in a sentence the panel can print as it stands.
 */
function assertPageImage(buffer: Buffer, declaredMime: string): { mime: string } {
  const detected = detectFileType(buffer);
  if (!detected || !PAGE_IMAGE_MIMES.includes(detected.mime)) {
    throw badRequest("Sayfa görseli yalnızca PNG, JPG veya WEBP olabilir.");
  }
  if (declaredMime && declaredMime !== detected.mime) {
    throw badRequest("Dosya içeriği bildirilen türle uyuşmuyor.");
  }
  if (buffer.length > MAX_PAGE_IMAGE_BYTES) {
    throw badRequest("Sayfa görseli çok büyük. Sınır: 25 MB.");
  }
  return { mime: detected.mime };
}

export type UploadedPage = { id: string; position: number; width: number | null; height: number | null };

/**
 * Stores a delivered page picture and makes a page of it.
 *
 * The bytes decide the type, not the name the browser sent, and anything that
 * is not one of the three page formats is refused with a sentence that says
 * which ones are. Nothing is written to the issue unless the file was stored.
 */
export async function addPageImage(
  actor: Actor,
  issueId: string,
  input: { buffer: Buffer; fileName: string; declaredMime: string; label?: string | null },
  meta: RequestMeta,
): Promise<UploadedPage> {
  assertLayoutRight(actor);
  await issueById(issueId);

  const detected = assertPageImage(input.buffer, input.declaredMime);
  const size = imageSize(input.buffer, detected.mime);

  const storageKey = buildStorageKey("issue-pages", input.fileName);
  await getStorage().put({
    bucket: "media",
    key: storageKey,
    body: input.buffer,
    mime: detected.mime,
  });

  const [row] = await db
    .insert(media)
    .values({
      storageKey,
      mime: detected.mime,
      size: input.buffer.length,
      uploadedBy: actor.id,
      // The magazine's own design, delivered by its own team
      licenseType: "own_work",
      altText: null,
    })
    .returning({ id: media.id });

  const position = await nextPosition(issueId);
  const [page] = await db
    .insert(issuePages)
    .values({
      issueId,
      position,
      // A delivered page bleeds to its edges; cover and back cover are set
      // afterwards from the list, which is also how they are undone
      template: "full_bleed",
      inContents: false,
      imageMediaId: row!.id,
      imageWidth: size?.width ?? null,
      imageHeight: size?.height ?? null,
      label: input.label?.trim() || null,
      blocks: [],
    })
    .returning({ id: issuePages.id });

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.image_added",
    entityType: "issue_pages",
    entityId: page!.id,
    after: { issueId, mime: detected.mime, size: input.buffer.length },
    ip: meta.ip,
  });

  return { id: page!.id, position, width: size?.width ?? null, height: size?.height ?? null };
}

/**
 * Puts a new picture on an existing page. The areas drawn on it are kept
 * exactly as they were — they are the work, not the file — but when the new
 * picture is a different shape the caller is told, because a rectangle stored
 * in fractions lands somewhere else on a page of different proportions.
 */
export async function replacePageImage(
  actor: Actor,
  pageId: string,
  input: { buffer: Buffer; fileName: string; declaredMime: string },
  meta: RequestMeta,
): Promise<{ aspectChanged: boolean }> {
  assertLayoutRight(actor);
  const rows = await db.select().from(issuePages).where(eq(issuePages.id, pageId)).limit(1);
  const page = rows[0];
  if (!page) throw notFound("Sayfa bulunamadı.");

  const detected = assertPageImage(input.buffer, input.declaredMime);
  const size = imageSize(input.buffer, detected.mime);
  const before =
    page.imageWidth && page.imageHeight ? { width: page.imageWidth, height: page.imageHeight } : null;

  const storageKey = buildStorageKey("issue-pages", input.fileName);
  await getStorage().put({ bucket: "media", key: storageKey, body: input.buffer, mime: detected.mime });

  const [row] = await db
    .insert(media)
    .values({
      storageKey,
      mime: detected.mime,
      size: input.buffer.length,
      uploadedBy: actor.id,
      licenseType: "own_work",
    })
    .returning({ id: media.id });

  await db
    .update(issuePages)
    .set({
      imageMediaId: row!.id,
      imageWidth: size?.width ?? null,
      imageHeight: size?.height ?? null,
      updatedAt: new Date(),
    })
    .where(eq(issuePages.id, pageId));

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.image_replaced",
    entityType: "issue_pages",
    entityId: pageId,
    after: { mime: detected.mime, size: input.buffer.length },
    ip: meta.ip,
  });

  return { aspectChanged: !sameAspect(before, size) };
}

/* ------------------------------------------------------------------ */
/* Clickable areas                                                     */
/* ------------------------------------------------------------------ */

/**
 * Saves the areas of one page as a set: what is sent is what the page has
 * afterwards. Areas that were on the page and are not in the list are
 * removed, ones with an id keep it (so a quiz bound to them stays bound), and
 * the rest are created.
 *
 * Replacing the set in one call is what the editor actually does — draw,
 * nudge, delete, save — and it means the page can never end up half saved.
 */
export async function saveHotspots(
  actor: Actor,
  pageId: string,
  rawList: unknown,
  meta: RequestMeta,
): Promise<void> {
  assertLayoutRight(actor);

  const rows = await db.select().from(issuePages).where(eq(issuePages.id, pageId)).limit(1);
  const page = rows[0];
  if (!page) throw notFound("Sayfa bulunamadı.");

  const parsed = hotspotListSchema.safeParse(rawList);
  if (!parsed.success) {
    // The list is an array, so the field names would be indices; the first
    // real message says more than "0.url" ever could
    const first = parsed.error.issues[0];
    throw badRequest(`Etkileşim alanları geçersiz: ${first?.message ?? "bilinmeyen hata"}`);
  }

  // A jump must point at a page of the same issue: sending a reader out of
  // the issue they are in is never what the rectangle meant
  const targets = parsed.data.map((area) => area.targetPageId).filter((id): id is string => Boolean(id));
  if (targets.length > 0) {
    const inside = await db
      .select({ id: issuePages.id })
      .from(issuePages)
      .where(and(eq(issuePages.issueId, page.issueId), inArray(issuePages.id, targets)));
    const known = new Set(inside.map((row) => row.id));
    if (targets.some((id) => !known.has(id))) {
      throw badRequest("Geçiş hedefi bu sayının sayfalarından biri olmalı.");
    }
  }

  const quizIds = parsed.data.map((area) => area.quizId).filter((id): id is string => Boolean(id));
  if (quizIds.length > 0) {
    const inside = await db
      .select({ id: issueQuizzes.id })
      .from(issueQuizzes)
      .where(and(eq(issueQuizzes.issueId, page.issueId), inArray(issueQuizzes.id, quizIds)));
    const known = new Set(inside.map((row) => row.id));
    if (quizIds.some((id) => !known.has(id))) {
      throw badRequest("Seçilen test bu sayıya ait değil.");
    }
  }

  const existing = await db
    .select({ id: issuePageHotspots.id })
    .from(issuePageHotspots)
    .where(eq(issuePageHotspots.pageId, pageId));
  const keep = new Set(parsed.data.map((area) => area.id).filter(Boolean) as string[]);

  for (const row of existing) {
    if (!keep.has(row.id)) {
      await db.delete(issuePageHotspots).where(eq(issuePageHotspots.id, row.id));
    }
  }

  for (const [index, area] of parsed.data.entries()) {
    const values = {
      pageId,
      position: index + 1,
      kind: area.kind,
      name: area.name ?? null,
      ariaLabel: area.ariaLabel ?? null,
      showMarker: area.showMarker ?? false,
      x: area.x,
      y: area.y,
      w: area.w,
      h: area.h,
      url: area.kind === "link" ? (safeExternalUrl(area.url ?? "") ?? null) : null,
      openInNewTab: area.openInNewTab ?? true,
      targetPageId: area.kind === "page" ? (area.targetPageId ?? null) : null,
      infoTitle: area.kind === "info" ? (area.infoTitle ?? null) : null,
      infoBody: area.kind === "info" ? (area.infoBody ?? null) : null,
      infoMediaId: area.kind === "info" ? (area.infoMediaId ?? null) : null,
      quizId: area.kind === "quiz" ? (area.quizId ?? null) : null,
      updatedAt: new Date(),
    };

    if (area.id && existing.some((row) => row.id === area.id)) {
      await db.update(issuePageHotspots).set(values).where(eq(issuePageHotspots.id, area.id));
    } else {
      await db.insert(issuePageHotspots).values(values);
    }
  }

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.hotspots_saved",
    entityType: "issue_pages",
    entityId: pageId,
    after: { count: parsed.data.length },
    ip: meta.ip,
  });
}

/** One page with everything the area editor needs around it. */
export async function readPageForEditing(
  actor: Actor,
  pageId: string,
): Promise<{ issue: Issue; page: IssuePageView; siblings: IssuePageView[] }> {
  assertLayoutRight(actor);
  const rows = await db.select().from(issuePages).where(eq(issuePages.id, pageId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Sayfa bulunamadı.");

  const issue = await issueById(row.issueId);
  const siblings = await pagesOf(issue.id, true);
  const page = siblings.find((candidate) => candidate.id === pageId);
  if (!page) throw notFound("Sayfa bulunamadı.");

  return { issue, page, siblings };
}
