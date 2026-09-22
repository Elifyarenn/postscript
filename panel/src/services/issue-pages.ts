import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, issuePages, issues, media, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { parseBlocks, issuePageBlocksSchema, type PageBlock } from "@/lib/issue-blocks";
import { PAGE_TEMPLATE_IDS, templateOf } from "@/lib/issue-templates";
import type { RequestMeta } from "./auth";

/**
 * The pages of an issue (D-234).
 *
 * Who may see what is decided here, not in a page component: a published issue
 * is open to any signed-in reader, everything else only to the editorial
 * panel. `readIssuePages` is the one door the reader route goes through, so an
 * unpublished issue cannot leak through a share link, a search or the page's
 * own data.
 *
 * Linking an article to a page never touches the article: its text, its status
 * and its own publication rules stay where they were.
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
  blocks: PageBlock[];
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
    publishedAt: Date | null;
  };
  pages: IssuePageView[];
  /** True when the reader is looking at something not yet published. */
  preview: boolean;
};

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
  imageAlt: media.altText,
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

function toView(row: Record<string, unknown>, preview: boolean): IssuePageView {
  const imageMediaId = row.imageMediaId as string | null;
  return {
    id: row.id as string,
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
    imageUrl: imageMediaId ? `/api/media/${imageMediaId}` : null,
    imageAlt: (row.imageAlt as string | null) ?? null,
    blocks: parseBlocks(row.blocks),
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
  return rows.map((row) => toView(row as Record<string, unknown>, preview));
}

/**
 * The reader's view of an issue. A signed-in reader gets a published issue;
 * anything else needs the editorial panel, and everyone else gets a 404 —
 * the same answer a missing issue gives, so nothing is confirmed to exist.
 */
export async function readIssuePages(actor: Actor | null, number: number): Promise<IssueReader> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.number, number), isNull(issues.deletedAt)))
    .limit(1);
  const issue = rows[0];
  if (!issue) throw notFound("Sayı bulunamadı.");

  const published = issue.status === "published" || issue.status === "archived";
  const mayPreview = actor !== null && canAccessEditorPanel(actor);
  if (!published && !mayPreview) throw notFound("Sayı bulunamadı.");

  return {
    issue: {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      theme: issue.theme,
      blurb: issue.blurb,
      status: issue.status,
      publishedAt: issue.publishedAt,
    },
    pages: await pagesOf(issue.id, !published),
    preview: !published,
  };
}

/** The panel's view: every page of an issue, whatever its state. */
export async function listIssuePages(actor: Actor, issueId: string): Promise<IssuePageView[]> {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  return pagesOf(issueId, true);
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

  // Out of the way first: the unique index would fight a direct renumbering
  await db
    .update(issuePages)
    .set({ position: sql`${issuePages.position} + 10000` })
    .where(eq(issuePages.issueId, issueId));

  for (const [index, row] of rows.entries()) {
    await db.update(issuePages).set({ position: index + 1 }).where(eq(issuePages.id, row.id));
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
    .select({ id: issuePages.id, position: issuePages.position })
    .from(issuePages)
    .where(eq(issuePages.issueId, page.issueId))
    .orderBy(asc(issuePages.position));

  const index = siblings.findIndex((row) => row.id === pageId);
  const target = direction === "up" ? index - 1 : index + 1;
  // Already at the edge: nothing to do, and no error either
  if (target < 0 || target >= siblings.length) return;

  const order = [...siblings];
  const [moved] = order.splice(index, 1);
  order.splice(target, 0, moved!);

  await db
    .update(issuePages)
    .set({ position: sql`${issuePages.position} + 10000` })
    .where(eq(issuePages.issueId, page.issueId));
  for (const [place, row] of order.entries()) {
    await db.update(issuePages).set({ position: place + 1 }).where(eq(issuePages.id, row.id));
  }

  await writeAudit({
    actorId: actor.id,
    action: "issue_page.moved",
    entityType: "issue_pages",
    entityId: pageId,
    after: { direction },
    ip: meta.ip,
  });
}
