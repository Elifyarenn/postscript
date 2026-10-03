/**
 * A temporary area for one issue (D-306).
 *
 * An admin lets a writer write in an area that is not theirs, for a single
 * issue: they may propose a topic in it and file an article under it there,
 * and nowhere else. The writer's own areas (`writer_area`, `writer_area2`) do
 * not change, and the area's quota does not count it. The writer is mailed
 * when it is given. Everything else (windows, contract, review chain) applies
 * as usual.
 */
import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issueAreaGrants, issues, users, writerAreas, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, canWriteInAnyArea, isActiveWriter, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "./mail-queue";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!canAccessAdminPanel(actor)) throw forbidden();
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

/** What one writer was given, for the admin's user page. */
export async function listIssueAreaGrantsForUser(actor: Actor, userId: string): Promise<IssueAreaGrantItem[]> {
  if (!canAccessAdminPanel(actor)) throw forbidden();
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
  if (!canAccessAdminPanel(actor)) throw forbidden();
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
  if (!canAccessAdminPanel(actor)) throw forbidden();
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
