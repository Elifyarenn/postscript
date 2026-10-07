/**
 * The active issue, kept in one place (D-330): a single `site_settings` row
 * the admin sets, read by the writer's new-article form, the server checks
 * and every article list's default. No second copy anywhere.
 */
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { issues, siteSettings, type Issue } from "@/db/schema";
import { ACTIVE_ISSUE_SETTING, isIssueClosed, pickActiveIssue } from "@/lib/active-issue";
import { writeAudit } from "@/lib/audit";
import { canManageIssues, type Actor } from "@/lib/auth/rbac";
import { conflict, forbidden, notFound } from "@/lib/errors";
import type { RequestMeta } from "./auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function chosenIssueId(): Promise<string | null> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, ACTIVE_ISSUE_SETTING))
    .limit(1);
  return row?.value.trim() || null;
}

/** The issue new articles go into; null only when no issue is open at all. */
export async function getActiveIssue(): Promise<Issue | null> {
  const [rows, chosen] = await Promise.all([
    db.select().from(issues).where(isNull(issues.deletedAt)),
    chosenIssueId(),
  ]);
  return pickActiveIssue(rows, chosen);
}

/** Whether the admin set it or the lowest open issue is used, for the issues screen. */
export async function activeIssueSource(): Promise<"setting" | "automatic"> {
  const [chosen, active] = await Promise.all([chosenIssueId(), getActiveIssue()]);
  return chosen !== null && active?.id === chosen ? "setting" : "automatic";
}

/** The admin makes an open issue the active one; the change is audited. */
export async function setActiveIssue(actor: Actor, issueId: string, meta: RequestMeta): Promise<Issue> {
  if (!canManageIssues(actor)) throw forbidden();
  if (!UUID.test(issueId)) throw notFound("Sayı bulunamadı.");
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw notFound("Sayı bulunamadı.");
  if (isIssueClosed(issue)) throw conflict("Yayımlanmış ya da arşivlenmiş bir sayı aktif sayı olamaz.");

  const before = await getActiveIssue();
  await db
    .insert(siteSettings)
    .values({ key: ACTIVE_ISSUE_SETTING, value: issue.id, updatedBy: actor.id })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: issue.id, updatedBy: actor.id, updatedAt: new Date() },
    });

  await writeAudit({
    actorId: actor.id,
    action: "issue.active_set",
    entityType: "issues",
    entityId: issue.id,
    before: { issueNumber: before?.number ?? null },
    after: { issueNumber: issue.number },
    ip: meta.ip,
  });
  return issue;
}

/**
 * Where a writer's new article may go (D-330): only the active issue. The
 * published issue 1 and any later, still planned issue are both refused.
 */
export async function assertActiveIssueForNewArticle(issueId: string): Promise<void> {
  const active = await getActiveIssue();
  if (!active) throw conflict("Şu an yazı kabul eden açık bir sayı yok.");
  if (active.id !== issueId) {
    throw conflict(`Yeni yazılar yalnızca aktif sayıya (Sayı ${active.number}) açılır.`);
  }
}
