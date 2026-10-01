/**
 * Opening an issue to one writer (D-296).
 *
 * An issue is closed to new articles when it is the admins' working issue
 * (D-240) or past planning. An admin can open it to a single writer; the
 * writer is told by e-mail at that moment. The grant only lets the writer
 * start an article in that issue: the contract, the areas and the review
 * chain apply exactly as they do everywhere else.
 *
 * An issue with windows is not opened this way: there the topic and delivery
 * windows decide (D-261), and a grant would be a second, conflicting rule.
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issueSubmissionGrants, issues, users, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, isActiveWriter, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { usesIssueWindows } from "@/lib/issue-periods";
import { sendMail } from "./mail-queue";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The issues this writer was let into, whatever their visibility or status. */
export async function grantedIssueIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ issueId: issueSubmissionGrants.issueId })
    .from(issueSubmissionGrants)
    .where(eq(issueSubmissionGrants.userId, userId));
  return rows.map((row) => row.issueId);
}

export async function hasIssueGrant(userId: string, issueId: string): Promise<boolean> {
  const rows = await db
    .select({ id: issueSubmissionGrants.id })
    .from(issueSubmissionGrants)
    .where(and(eq(issueSubmissionGrants.userId, userId), eq(issueSubmissionGrants.issueId, issueId)))
    .limit(1);
  return rows.length > 0;
}

/** The issues a grant can be given for: live and without windows, newest first. */
export async function listGrantableIssues(actor: Actor): Promise<Issue[]> {
  if (!canAccessAdminPanel(actor)) throw forbidden();
  return db
    .select()
    .from(issues)
    .where(and(isNull(issues.deletedAt), isNull(issues.topicOpensAt), isNull(issues.submissionOpensAt)))
    .orderBy(desc(issues.number));
}

export type IssueGrantItem = { id: string; issueId: string; issueNumber: number; issueTitle: string; createdAt: Date };

/** What one writer was let into, for the admin's user page. */
export async function listIssueGrantsForUser(actor: Actor, userId: string): Promise<IssueGrantItem[]> {
  if (!canAccessAdminPanel(actor)) throw forbidden();
  return db
    .select({
      id: issueSubmissionGrants.id,
      issueId: issues.id,
      issueNumber: issues.number,
      issueTitle: issues.title,
      createdAt: issueSubmissionGrants.createdAt,
    })
    .from(issueSubmissionGrants)
    .innerJoin(issues, eq(issueSubmissionGrants.issueId, issues.id))
    .where(eq(issueSubmissionGrants.userId, userId))
    .orderBy(desc(issueSubmissionGrants.createdAt));
}

/**
 * Lets one writer start an article in the issue and mails them. Admin only;
 * the writer must be an active writer, since nobody else can write at all.
 */
export async function grantIssueSubmission(
  actor: Actor,
  input: { issueId: string; userId: string },
  meta: RequestMeta,
): Promise<void> {
  if (!canAccessAdminPanel(actor)) throw forbidden();
  if (!UUID.test(input.issueId) || !UUID.test(input.userId)) throw notFound("Sayı ya da kullanıcı bulunamadı.");

  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, input.issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw notFound("Sayı bulunamadı.");
  if (usesIssueWindows(issue)) {
    throw conflict("Bu sayıda konu ve yazı kabul dönemleri geçerli; kişiye özel izin verilemez.");
  }

  const [person] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.userId), isNull(users.deletedAt)))
    .limit(1);
  if (!person) throw notFound("Kullanıcı bulunamadı.");
  if (!isActiveWriter(person)) {
    throw conflict("Yalnızca aktif bir yazara yazı gönderme izni verilebilir.");
  }

  const [row] = await db
    .insert(issueSubmissionGrants)
    .values({ issueId: issue.id, userId: person.id, grantedBy: actor.id })
    .onConflictDoNothing()
    .returning({ id: issueSubmissionGrants.id });
  if (!row) throw conflict("Bu yazarın bu sayı için izni zaten var.");

  await writeAudit({
    actorId: actor.id,
    action: "issue.submission_granted",
    entityType: "issues",
    entityId: issue.id,
    after: { userId: person.id, issueNumber: issue.number },
    ip: meta.ip,
  });

  // Told at the moment it opens; the queue retries if the mail server is down
  await sendMail({
    to: person.email,
    ...templates.issueSubmissionGranted({
      displayName: person.displayName,
      issueLabel: `Sayı ${issue.number} · ${issue.title}`,
      url: `${env().APP_URL}/writer/articles/new`,
    }),
  });
}

/** Takes the door back. Articles already started in the issue stay where they are. */
export async function revokeIssueSubmission(actor: Actor, grantId: string, meta: RequestMeta): Promise<void> {
  if (!canAccessAdminPanel(actor)) throw forbidden();
  if (!UUID.test(grantId)) throw notFound("İzin bulunamadı.");
  const [row] = await db
    .delete(issueSubmissionGrants)
    .where(eq(issueSubmissionGrants.id, grantId))
    .returning({ issueId: issueSubmissionGrants.issueId, userId: issueSubmissionGrants.userId });
  if (!row) throw notFound("İzin bulunamadı.");
  await writeAudit({
    actorId: actor.id,
    action: "issue.submission_grant_revoked",
    entityType: "issues",
    entityId: row.issueId,
    after: { userId: row.userId },
    ip: meta.ip,
  });
}
