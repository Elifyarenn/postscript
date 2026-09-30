/**
 * Works left behind by people the admin removed from the writer role, for
 * which the author never signed a licence (D-279).
 *
 * Without a signed `rights_grants` row the magazine holds no licence for the
 * text, and its author is no longer a writer, so the admin removes it. The
 * removal is the soft delete every list already honours (`deleted_at`):
 * the work leaves the site and the panel, while the row and its
 * `article_versions` history stay, because the content retention question
 * (5187, CLAUDE.md) is still open. Nothing here deletes a row of a work.
 *
 * Unsigned contributor documents prepared for these works (D-276) go with
 * them: they were never sent, and they describe a licence that will not be.
 */
import "server-only";
import { and, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { articles, contributorDocuments, rightsGrants, roleChanges, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { forbidden } from "@/lib/errors";
import type { RequestMeta } from "./auth";

export type UnlicensedWork = {
  id: string;
  title: string;
  status: string;
  authorId: string;
  authorName: string;
};

/**
 * The works to remove: not deleted, written by someone who is now a plain
 * user after having been a writer, and with no signed licence. An author the
 * records never show as a writer is not assumed to be a removed one.
 */
export async function listUnlicensedFormerWriterWorks(actor: Actor): Promise<UnlicensedWork[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  return db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      authorId: users.id,
      authorName: users.displayName,
    })
    .from(articles)
    .innerJoin(users, eq(articles.authorId, users.id))
    .where(
      and(
        isNull(articles.deletedAt),
        eq(users.role, "user"),
        sql`exists (select 1 from ${roleChanges} where ${roleChanges.userId} = ${users.id} and ${roleChanges.oldRole} = 'writer')`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(rightsGrants)
            .where(and(eq(rightsGrants.articleId, articles.id), eq(rightsGrants.status, "signed"))),
        ),
      ),
    )
    .orderBy(users.displayName, articles.title);
}

/**
 * Removes the works the admin saw and confirmed. The list is worked out again
 * here, so an id that no longer qualifies (or never did) is left alone.
 */
export async function removeUnlicensedFormerWriterWorks(
  actor: Actor,
  confirmedIds: readonly string[],
  meta: RequestMeta,
): Promise<{ removed: number; documentsRemoved: number }> {
  if (!canManageAgreements(actor)) throw forbidden();
  const confirmed = new Set(confirmedIds);
  const works = (await listUnlicensedFormerWriterWorks(actor)).filter((work) => confirmed.has(work.id));
  if (works.length === 0) return { removed: 0, documentsRemoved: 0 };

  const ids = works.map((work) => work.id);
  const authorIds = [...new Set(works.map((work) => work.authorId))];
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(articles)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(inArray(articles.id, ids), isNull(articles.deletedAt)));

    const licences = await tx
      .delete(contributorDocuments)
      .where(and(eq(contributorDocuments.kind, "work_licence"), inArray(contributorDocuments.articleId, ids)))
      .returning({ id: contributorDocuments.id });

    // A removed writer who has no work left and draws nothing is no longer a
    // contributor; their unsent contract goes as well
    const stillContributing = await tx
      .select({ id: articles.authorId })
      .from(articles)
      .where(and(inArray(articles.authorId, authorIds), isNull(articles.deletedAt)));
    const illustrators = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, authorIds), eq(users.isIllustrator, true)));
    const keep = new Set([...stillContributing, ...illustrators].map((row) => row.id));
    const gone = authorIds.filter((id) => !keep.has(id));
    const contracts = gone.length
      ? await tx
          .delete(contributorDocuments)
          .where(and(eq(contributorDocuments.kind, "general_agreement"), inArray(contributorDocuments.userId, gone)))
          .returning({ id: contributorDocuments.id })
      : [];

    for (const work of works) {
      await writeAudit(
        {
          actorId: actor.id,
          action: "article.removed_unlicensed_former_writer",
          entityType: "articles",
          entityId: work.id,
          before: { status: work.status, authorId: work.authorId, deletedAt: null },
          after: { deletedAt: now.toISOString() },
          ip: meta.ip,
        },
        tx,
      );
    }
    return { removed: works.length, documentsRemoved: licences.length + contracts.length };
  });
}
