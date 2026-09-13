/**
 * An article's step history, for the admin (D-106).
 *
 * Every step is already in the append-only audit log, so nothing new is stored.
 * Only the admin reads it, because the audit log is theirs; the IP address is
 * left out all the same, since the article page has no use for it.
 */
import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, rightsGrants, users } from "@/db/schema";
import { describeStep, type HistoryStep } from "@/lib/article-history";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { forbidden } from "@/lib/errors";
import { findArticleById } from "@/services/articles";

/** Far above any real article's step count; a guard, not a page size. */
const HISTORY_LIMIT = 500;

export async function listArticleHistory(actor: Actor, articleId: string): Promise<HistoryStep[]> {
  if (!canAccessAdminPanel(actor)) throw forbidden();

  // An unknown id is a 404, not an empty history
  await findArticleById(articleId);

  // Work approval events are logged against the grant, not the article
  const grants = await db
    .select({ id: rightsGrants.id })
    .from(rightsGrants)
    .where(eq(rightsGrants.articleId, articleId));

  const articleRows = and(eq(auditLog.entityType, "articles"), eq(auditLog.entityId, articleId));
  const scope =
    grants.length > 0
      ? or(
          articleRows,
          and(
            eq(auditLog.entityType, "rights_grants"),
            inArray(
              auditLog.entityId,
              grants.map((grant) => grant.id),
            ),
          ),
        )
      : articleRows;

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
      actorName: users.displayName,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(scope)
    .orderBy(asc(auditLog.createdAt))
    .limit(HISTORY_LIMIT);

  return rows.map(describeStep);
}
