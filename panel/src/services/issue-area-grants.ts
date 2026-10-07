/**
 * A temporary area for one issue (D-306).
 *
 * An admin, or the main editor (D-330), lets a writer write in an area that is not theirs, for a single
 * issue: they may propose a topic in it and file an article under it there,
 * and nowhere else. The writer's own areas (`writer_area`, `writer_area2`) do
 * not change, and the area's quota does not count it. The writer is mailed
 * when it is given. Everything else (windows, contract, review chain) applies
 * as usual.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, type Article, issueAreaGrants, issues, users, writerAreas, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageIssueAreaGrants, canWriteInAnyArea, isActiveWriter, type Actor } from "@/lib/auth/rbac";
import { countWords } from "@/lib/word-count";
import { env } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "./mail-queue";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admins and the main editor (D-330). The mark is read from the account
 * here: `getEditorAssignment`'s module imports this one.
 */
async function assertMayManage(actor: Actor): Promise<void> {
  const [row] =
    actor.role === "editor"
      ? await db.select({ isMainEditor: users.isMainEditor }).from(users).where(eq(users.id, actor.id)).limit(1)
      : [];
  if (!canManageIssueAreaGrants(actor, row ?? null)) throw forbidden();
}

/** For the panel's menu and the temporary-area screen. */
export async function mayManageIssueAreaGrants(actor: Actor): Promise<boolean> {
  try {
    await assertMayManage(actor);
    return true;
  } catch {
    return false;
  }
}

/** The live areas this writer was given for one issue. */
export async function temporaryAreasFor(userId: string, issueId: string): Promise<string[]> {
  if (!UUID.test(issueId)) return [];
  const rows = await db
    .select({ name: writerAreas.name })
    .from(issueAreaGrants)
    .innerJoin(writerAreas, eq(issueAreaGrants.areaId, writerAreas.id))
    .where(
      and(
        eq(issueAreaGrants.userId, userId),
        eq(issueAreaGrants.issueId, issueId),
        eq(writerAreas.isActive, true),
      ),
    )
    .orderBy(writerAreas.sortOrder);
  return rows.map((row) => row.name);
}

/** Every live temporary area of this writer, keyed by issue id. */
export async function temporaryAreasByIssue(userId: string): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ issueId: issueAreaGrants.issueId, name: writerAreas.name })
    .from(issueAreaGrants)
    .innerJoin(writerAreas, eq(issueAreaGrants.areaId, writerAreas.id))
    .where(and(eq(issueAreaGrants.userId, userId), eq(writerAreas.isActive, true)))
    .orderBy(writerAreas.sortOrder);
  const byIssue = new Map<string, string[]>();
  for (const row of rows) byIssue.set(row.issueId, [...(byIssue.get(row.issueId) ?? []), row.name]);
  return byIssue;
}

/** The issues an area can be given for: live and not yet published, newest first. */
export async function listAreaGrantableIssues(actor: Actor): Promise<Issue[]> {
  await assertMayManage(actor);
  return db
    .select()
    .from(issues)
    .where(and(isNull(issues.deletedAt), inArray(issues.status, ["planning", "in_production"])))
    .orderBy(desc(issues.number));
}

export type IssueAreaGrantItem = {
  id: string;
  issueId: string;
  issueNumber: number;
  issueTitle: string;
  areaName: string;
  createdAt: Date;
};

export type IssueAreaGrantRow = {
  id: string;
  userId: string;
  writerName: string;
  areaName: string;
  createdAt: Date;
  articles: { id: string; title: string; status: Article["status"]; wordCount: number }[];
};

/**
 * One issue's temporary areas with the articles written under each (D-330):
 * the screen the main editor hands them out from. Only that issue's articles.
 */
export async function listIssueAreaGrantsForIssue(actor: Actor, issueId: string): Promise<IssueAreaGrantRow[]> {
  await assertMayManage(actor);
  if (!UUID.test(issueId)) return [];
  const grants = await db
    .select({
      id: issueAreaGrants.id,
      userId: issueAreaGrants.userId,
      writerName: users.displayName,
      penName: users.penName,
      areaName: writerAreas.name,
      createdAt: issueAreaGrants.createdAt,
    })
    .from(issueAreaGrants)
    .innerJoin(users, eq(issueAreaGrants.userId, users.id))
    .innerJoin(writerAreas, eq(issueAreaGrants.areaId, writerAreas.id))
    .where(eq(issueAreaGrants.issueId, issueId))
    .orderBy(asc(writerAreas.sortOrder), asc(users.displayName));
  if (grants.length === 0) return [];

  const written = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      authorId: articles.authorId,
      category: articles.category,
      bodyMarkdown: articles.bodyMarkdown,
    })
    .from(articles)
    .where(
      and(
        isNull(articles.deletedAt),
        eq(articles.issueId, issueId),
        inArray(articles.authorId, [...new Set(grants.map((grant) => grant.userId))]),
      ),
    )
    .orderBy(asc(articles.title));

  return grants.map((grant) => ({
    id: grant.id,
    userId: grant.userId,
    writerName: grant.penName ?? grant.writerName,
    areaName: grant.areaName,
    createdAt: grant.createdAt,
    articles: written
      .filter((article) => article.authorId === grant.userId && article.category === grant.areaName)
      .map((article) => ({
        id: article.id,
        title: article.title,
        status: article.status,
        wordCount: countWords(article.bodyMarkdown),
      })),
  }));
}

/** Who may be given a temporary area: active writers who are not admins (D-304). */
export async function listTemporaryAreaCandidates(actor: Actor) {
  await assertMayManage(actor);
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      penName: users.penName,
      role: users.role,
      writerStatus: users.writerStatus,
      writerArea: users.writerArea,
      writerArea2: users.writerArea2,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.writerStatus, "active"), inArray(users.role, ["writer", "editor"])))
    .orderBy(asc(users.displayName));
  return rows;
}

/** The live areas, for the grant form. */
export async function listLiveAreas(actor: Actor) {
  await assertMayManage(actor);
  return db
    .select({ id: writerAreas.id, name: writerAreas.name })
    .from(writerAreas)
    .where(eq(writerAreas.isActive, true))
    .orderBy(asc(writerAreas.sortOrder));
}

/** What one writer was given, for the admin's user page. */
export async function listIssueAreaGrantsForUser(actor: Actor, userId: string): Promise<IssueAreaGrantItem[]> {
  await assertMayManage(actor);
  return db
    .select({
      id: issueAreaGrants.id,
      issueId: issues.id,
      issueNumber: issues.number,
      issueTitle: issues.title,
      areaName: writerAreas.name,
      createdAt: issueAreaGrants.createdAt,
    })
    .from(issueAreaGrants)
    .innerJoin(issues, eq(issueAreaGrants.issueId, issues.id))
    .innerJoin(writerAreas, eq(issueAreaGrants.areaId, writerAreas.id))
    .where(eq(issueAreaGrants.userId, userId))
    .orderBy(desc(issues.number), writerAreas.sortOrder);
}

/**
 * Gives one writer an area for one issue and mails them. Admin only; the
 * writer must be an active writer, and the area must be live and not already
 * one of their own.
 */
export async function grantIssueArea(
  actor: Actor,
  input: { issueId: string; userId: string; areaId: string },
  meta: RequestMeta,
): Promise<void> {
  await assertMayManage(actor);
  if (![input.issueId, input.userId, input.areaId].every((value) => UUID.test(value))) {
    throw notFound("Sayı, alan ya da kullanıcı bulunamadı.");
  }

  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, input.issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw notFound("Sayı bulunamadı.");
  if (issue.status !== "planning" && issue.status !== "in_production") {
    throw conflict("Yayımlanmış bir sayı için geçici alan verilemez.");
  }

  const [area] = await db.select().from(writerAreas).where(eq(writerAreas.id, input.areaId)).limit(1);
  if (!area || !area.isActive) throw notFound("Alan bulunamadı.");

  const [person] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
    .limit(1);
  if (!person) throw notFound("Kullanıcı bulunamadı.");
  if (!isActiveWriter(person)) throw conflict("Yalnızca aktif bir yazara geçici alan verilebilir.");
  // An admin already writes in every area (D-304)
  if (canWriteInAnyArea(person)) throw conflict("Adminler zaten her alanda yazabilir.");
  if (person.writerArea === area.name || person.writerArea2 === area.name) {
    throw conflict("Bu alan yazarın kendi alanı; geçici alan gerekmez.");
  }

  const [row] = await db
    .insert(issueAreaGrants)
    .values({ issueId: issue.id, userId: person.id, areaId: area.id, grantedBy: actor.id })
    .onConflictDoNothing()
    .returning({ id: issueAreaGrants.id });
  if (!row) throw conflict("Yazarın bu sayı için bu alanı zaten var.");

  await writeAudit({
    actorId: actor.id,
    action: "issue.area_granted",
    entityType: "issues",
    entityId: issue.id,
    after: { userId: person.id, issueNumber: issue.number, area: area.name },
    ip: meta.ip,
  });

  // Told at the moment it is given; the queue retries if the mail server is down
  await sendMail({
    to: person.email,
    ...templates.issueAreaGranted({
      displayName: person.displayName,
      issueLabel: `Sayı ${issue.number} · ${issue.title}`,
      areaName: area.name,
      url: `${env().APP_URL}/writer/topics`,
    }),
  });
}

/** Takes the area back. Topics and articles already filed under it stay as they are. */
export async function revokeIssueArea(actor: Actor, grantId: string, meta: RequestMeta): Promise<void> {
  await assertMayManage(actor);
  if (!UUID.test(grantId)) throw notFound("Geçici alan bulunamadı.");
  const [row] = await db
    .delete(issueAreaGrants)
    .where(eq(issueAreaGrants.id, grantId))
    .returning({ issueId: issueAreaGrants.issueId, userId: issueAreaGrants.userId, areaId: issueAreaGrants.areaId });
  if (!row) throw notFound("Geçici alan bulunamadı.");
  await writeAudit({
    actorId: actor.id,
    action: "issue.area_grant_revoked",
    entityType: "issues",
    entityId: row.issueId,
    after: { userId: row.userId, areaId: row.areaId },
    ip: meta.ip,
  });
}
