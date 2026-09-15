/**
 * Read models for the public API (§10).
 *
 * Nothing in here needs a session, and nothing in here may leak private data:
 * an author's e-mail, legal name and birth date never appear in a response.
 * A withdrawn article answers 410, anything else unpublished answers 404.
 */
import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, issues, media, rightsGrants, users } from "@/db/schema";
import { gone, notFound } from "@/lib/errors";
import { renderMarkdown } from "@/lib/markdown";
import { containsPattern } from "@/lib/search";

/** The reading screen's search box and category links (D-112). */
export const articleFilterSchema = z.strictObject({
  query: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
});

/**
 * How many published articles each category holds, most first — the profile
 * page's side column (D-113). Counts only: which article is in which category
 * is already public on the reading screen.
 */
export async function listCategoryCounts(): Promise<{ category: string; count: number }[]> {
  const rows = await db
    .select({ category: articles.category, count: count() })
    .from(articles)
    .where(
      and(eq(articles.status, "published"), isNull(articles.deletedAt), isNotNull(articles.category)),
    )
    .groupBy(articles.category)
    .orderBy(desc(count()), asc(articles.category));

  return rows.flatMap((row) =>
    row.category ? [{ category: row.category, count: Number(row.count) }] : [],
  );
}

/** Shown when an article has a byline we are not allowed to fill in. */
const ANONYMOUS_BYLINE = "İsimsiz";

/**
 * Join condition for the signed rights grant of an article. The partial unique
 * index on `rights_grants` allows one live grant per article, so this matches
 * at most one row and no aliasing or grouping is needed.
 */
function signedGrantFor(articleId: PgColumn) {
  return and(eq(rightsGrants.articleId, articleId), eq(rightsGrants.status, "signed"));
}

/**
 * The name an article may actually be published under (D-076).
 *
 * A legal name is only public when the writer chose it themselves: the
 * `byline_choice` they signed on the rights grant is the consent, and the
 * signing flow already refuses `pen_name` from someone with no pen name. With
 * no signed choice the pen name is the only safe answer, and where there is
 * none either the byline stays anonymous.
 *
 * The old fallback was `penName ?? displayName`, which published the legal name
 * of every writer who had not set a pen name — against the CLAUDE.md rule that
 * the public API returns no real name, and without anyone having agreed to it.
 */
function publicByline(row: {
  penName: string | null;
  displayName: string;
  bylineChoice: "real_name" | "pen_name" | null;
}): string {
  if (row.bylineChoice === "real_name") return row.displayName;
  return row.penName ?? ANONYMOUS_BYLINE;
}

/** The only author fields that may ever be public. */
function publicAuthor(row: {
  penName: string | null;
  displayName: string;
  penNameSlug: string | null;
  bio: string | null;
  socialLinks: unknown;
  bylineChoice: "real_name" | "pen_name" | null;
}) {
  return {
    name: publicByline(row),
    slug: row.penNameSlug,
    bio: row.bio,
    socialLinks: row.socialLinks ?? null,
  };
}

export async function listPublishedIssues() {
  const rows = await db
    .select({
      number: issues.number,
      title: issues.title,
      theme: issues.theme,
      publishedAt: issues.publishedAt,
      coverKey: media.storageKey,
    })
    .from(issues)
    .leftJoin(media, eq(issues.coverMediaId, media.id))
    .where(and(eq(issues.status, "published"), isNull(issues.deletedAt)))
    .orderBy(desc(issues.number));

  return rows;
}

export async function getPublishedIssue(number: number) {
  const issueRows = await db
    .select({
      number: issues.number,
      title: issues.title,
      theme: issues.theme,
      publishedAt: issues.publishedAt,
      id: issues.id,
    })
    .from(issues)
    .where(and(eq(issues.number, number), eq(issues.status, "published"), isNull(issues.deletedAt)))
    .limit(1);

  const issue = issueRows[0];
  if (!issue) throw notFound("Sayı bulunamadı.");

  const contents = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      summary: articles.summary,
      orderInIssue: articles.orderInIssue,
      publishedAt: articles.publishedAt,
      penName: users.penName,
      displayName: users.displayName,
      authorSlug: users.penNameSlug,
      bylineChoice: rightsGrants.bylineChoice,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(rightsGrants, signedGrantFor(articles.id))
    .where(
      and(eq(articles.issueId, issue.id), eq(articles.status, "published"), isNull(articles.deletedAt)),
    )
    .orderBy(asc(articles.orderInIssue), asc(articles.publishedAt));

  return {
    number: issue.number,
    title: issue.title,
    theme: issue.theme,
    publishedAt: issue.publishedAt,
    articles: contents.map((row) => ({
      title: row.title,
      slug: row.slug,
      summary: row.summary,
      order: row.orderInIssue,
      publishedAt: row.publishedAt,
      author: row.displayName
        ? publicByline({
            penName: row.penName,
            displayName: row.displayName,
            bylineChoice: row.bylineChoice,
          })
        : null,
      authorSlug: row.authorSlug,
    })),
  };
}

/**
 * A published article, rendered. A withdrawn one throws `gone` so the route can
 * answer 410 rather than pretending it never existed (§8).
 */
export async function getPublicArticle(slug: string) {
  const rows = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      summary: articles.summary,
      bodyMarkdown: articles.bodyMarkdown,
      status: articles.status,
      category: articles.category,
      publishedAt: articles.publishedAt,
      issueNumber: issues.number,
      penName: users.penName,
      displayName: users.displayName,
      penNameSlug: users.penNameSlug,
      bio: users.bio,
      socialLinks: users.socialLinks,
      bylineChoice: rightsGrants.bylineChoice,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(issues, eq(articles.issueId, issues.id))
    .leftJoin(rightsGrants, signedGrantFor(articles.id))
    .where(and(eq(articles.slug, slug), isNull(articles.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("Yazı bulunamadı.");
  if (row.status === "withdrawn") throw gone("Bu yazı geri çekildi.");
  if (row.status !== "published") throw notFound("Yazı bulunamadı.");

  return {
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    html: await renderMarkdown(row.bodyMarkdown),
    category: row.category,
    publishedAt: row.publishedAt,
    issueNumber: row.issueNumber,
    author: row.displayName
      ? publicAuthor({
          penName: row.penName,
          displayName: row.displayName,
          penNameSlug: row.penNameSlug,
          bio: row.bio,
          socialLinks: row.socialLinks,
          bylineChoice: row.bylineChoice,
        })
      : null,
  };
}

export async function getPublicAuthor(penNameSlug: string) {
  const rows = await db
    .select({
      penName: users.penName,
      displayName: users.displayName,
      penNameSlug: users.penNameSlug,
      bio: users.bio,
      socialLinks: users.socialLinks,
      id: users.id,
    })
    .from(users)
    .where(and(eq(users.penNameSlug, penNameSlug), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw notFound("Yazar bulunamadı.");

  const published = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      publishedAt: articles.publishedAt,
      issueNumber: issues.number,
    })
    .from(articles)
    .leftJoin(issues, eq(articles.issueId, issues.id))
    .where(
      and(eq(articles.authorId, row.id), eq(articles.status, "published"), isNull(articles.deletedAt)),
    )
    .orderBy(desc(articles.publishedAt));

  // This page is reached by pen-name slug, so the pen name is the byline by
  // construction; there is no single article here whose grant could say
  // otherwise (D-076).
  return { ...publicAuthor({ ...row, bylineChoice: "pen_name" }), articles: published };
}

/**
 * The newest published articles, whatever issue they belong to.
 *
 * The reader's magazine screen leads with this rather than with the issue list,
 * because an article can be published before its issue is.
 */
export async function listRecentArticles(limit = 20, rawFilter: unknown = {}) {
  // A malformed filter (say, a hand-edited URL) reads as no filter, not as an error
  const parsed = articleFilterSchema.safeParse(rawFilter);
  const filter = parsed.success ? parsed.data : {};

  const conditions = [eq(articles.status, "published"), isNull(articles.deletedAt)];
  if (filter.category) conditions.push(eq(articles.category, filter.category));
  if (filter.query) {
    const pattern = containsPattern(filter.query);
    conditions.push(or(ilike(articles.title, pattern), ilike(articles.summary, pattern))!);
  }

  const rows = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      summary: articles.summary,
      category: articles.category,
      publishedAt: articles.publishedAt,
      issueNumber: issues.number,
      penName: users.penName,
      displayName: users.displayName,
      authorSlug: users.penNameSlug,
      bylineChoice: rightsGrants.bylineChoice,
    })
    .from(articles)
    .leftJoin(users, eq(articles.authorId, users.id))
    .leftJoin(issues, eq(articles.issueId, issues.id))
    .leftJoin(rightsGrants, signedGrantFor(articles.id))
    .where(and(...conditions))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  // The byline is resolved here, so `display_name` never leaves this module
  return rows.map(({ penName, displayName, bylineChoice, ...rest }) => ({
    ...rest,
    authorName: displayName
      ? publicByline({ penName, displayName, bylineChoice })
      : null,
  }));
}

/**
 * The writers the about page lists (D-112): anyone with a pen name page and at
 * least one published article. Pen names only — the page is public, and a
 * legal name is never listed (D-076).
 */
export async function listPublicAuthors(): Promise<{ name: string; slug: string }[]> {
  const rows = await db
    .selectDistinct({ name: users.penName, slug: users.penNameSlug })
    .from(users)
    .innerJoin(articles, eq(articles.authorId, users.id))
    .where(
      and(
        isNotNull(users.penName),
        isNotNull(users.penNameSlug),
        isNull(users.deletedAt),
        eq(articles.status, "published"),
        isNull(articles.deletedAt),
      ),
    )
    .orderBy(asc(users.penName));

  return rows.flatMap((row) => (row.name && row.slug ? [{ name: row.name, slug: row.slug }] : []));
}

export type PublicStaffMember = { name: string; href: string };

/**
 * The about page's writers and editors (D-135), read from the accounts that
 * hold the role rather than from bylines, so someone who has not published yet
 * is listed too. Only names the public site may show are read: the pen name,
 * or else the community handle. Nobody's real name, e-mail or birth date
 * leaves this function. A banned, suspended, deleted or anonymised account, or
 * one with no public name at all, is left out.
 */
export async function listPublicStaff(role: "writer" | "editor"): Promise<PublicStaffMember[]> {
  const rows = await db
    .select({
      penName: users.penName,
      penNameSlug: users.penNameSlug,
      username: users.username,
      writerStatus: users.writerStatus,
      editorStatus: users.editorStatus,
    })
    .from(users)
    .where(
      and(
        eq(users.role, role),
        eq(users.isBanned, false),
        isNull(users.deletedAt),
        isNull(users.anonymizedAt),
      ),
    );

  const members = rows.flatMap((row): PublicStaffMember[] => {
    const status = role === "writer" ? row.writerStatus : row.editorStatus;
    if (status === "suspended") return [];
    if (row.penName && row.penNameSlug) {
      return [{ name: row.penName, href: `/magazine/authors/${row.penNameSlug}` }];
    }
    if (row.username) return [{ name: `@${row.username}`, href: `/social/u/${row.username}` }];
    return [];
  });

  return members.sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
