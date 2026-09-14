/**
 * An article's step history (D-106, D-107).
 *
 * Every step is already in the append-only audit log, so nothing new is stored.
 * Whoever may read the article may read its steps: the admin, an editor whose
 * areas cover it, and its author. The author sees them the way their inbox told
 * them, without the plagiarism assessment and without reviewers' notes from the
 * internal stages. The IP address the audit log holds is left out for everyone.
 */
import "server-only";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, rightsGrants, users } from "@/db/schema";
import { describeStep, stepsForAudience, type HistoryStep } from "@/lib/article-history";
import { canAccessEditorPanel, type Actor } from "@/lib/auth/rbac";
import { assertCanReadArticle, findArticleById } from "@/services/articles";

/** Far above any real article's step count; a guard, not a page size. */
const HISTORY_LIMIT = 500;

export async function listArticleHistory(actor: Actor, articleId: string): Promise<HistoryStep[]> {
  // An unknown id is a 404; then the same gate the notes and versions use
  const article = await findArticleById(articleId);
  await assertCanReadArticle(actor, article);

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

  return stepsForAudience(
    rows.map(describeStep),
    canAccessEditorPanel(actor) ? "staff" : "author",
  );
}
