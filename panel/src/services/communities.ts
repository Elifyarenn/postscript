/**
 * Communities (D-093): topic groups inside the community area.
 *
 * Only an admin opens or archives a community, so there are no group owners to
 * moderate and no second tier of moderators. Members join, leave and post;
 * who belongs to a community is not listed anywhere, only how many do.
 */
import "server-only";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { communities, communityMemberships } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { assertMayPost } from "./community";
import { requireMember } from "./social";
import type { RequestMeta } from "./auth";

export type CommunitySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  memberCount: number;
  isMember: boolean;
  archived: boolean;
};

async function withCounts(
  viewerId: string,
  rows: { id: string; slug: string; name: string; description: string | null; archivedAt: Date | null }[],
): Promise<CommunitySummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [counts, mine] = await Promise.all([
    db
      .select({ communityId: communityMemberships.communityId, value: count() })
      .from(communityMemberships)
      .where(inArray(communityMemberships.communityId, ids))
      .groupBy(communityMemberships.communityId),
    db
      .select({ communityId: communityMemberships.communityId })
      .from(communityMemberships)
      .where(and(eq(communityMemberships.userId, viewerId), inArray(communityMemberships.communityId, ids))),
  ]);

  const countById = new Map(counts.map((row) => [row.communityId, row.value]));
  const memberOf = new Set(mine.map((row) => row.communityId));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    memberCount: countById.get(row.id) ?? 0,
    isMember: memberOf.has(row.id),
    archived: row.archivedAt !== null,
  }));
}

const summaryColumns = {
  id: communities.id,
  slug: communities.slug,
  name: communities.name,
  description: communities.description,
  archivedAt: communities.archivedAt,
};

/** The open communities, alphabetically. */
export async function listCommunities(actor: Actor): Promise<CommunitySummary[]> {
  assertMayPost(actor);
  const rows = await db
    .select(summaryColumns)
    .from(communities)
    .where(isNull(communities.archivedAt))
    .orderBy(asc(communities.name));
  return withCounts(actor.id, rows);
}

/** One community; an archived one is still shown, read-only. */
export async function getCommunity(actor: Actor, slug: string): Promise<CommunitySummary> {
  assertMayPost(actor);
  const rows = await db.select(summaryColumns).from(communities).where(eq(communities.slug, slug)).limit(1);
  if (!rows[0]) throw notFound("Topluluk bulunamadı.");
  const [summary] = await withCounts(actor.id, rows);
  return summary!;
}

async function openCommunityBySlug(slug: string) {
  const rows = await db
    .select({ id: communities.id, archivedAt: communities.archivedAt })
    .from(communities)
    .where(eq(communities.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Topluluk bulunamadı.");
  if (row.archivedAt) throw conflict("Bu topluluk arşivlendi.");
  return row;
}

async function isMemberOf(userId: string, communityId: string): Promise<boolean> {
  const rows = await db
    .select({ id: communityMemberships.id })
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** Joining shows up in the member count, so it asks for a handle like any social act. */
export async function joinCommunity(actor: Actor, slug: string): Promise<void> {
  const me = await requireMember(actor);
  const community = await openCommunityBySlug(slug);
  if (await isMemberOf(me.id, community.id)) return;
  await db.insert(communityMemberships).values({ communityId: community.id, userId: me.id });
}

export async function leaveCommunity(actor: Actor, slug: string): Promise<void> {
  assertMayPost(actor);
  const rows = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug)).limit(1);
  if (!rows[0]) throw notFound("Topluluk bulunamadı.");
  await db
    .delete(communityMemberships)
    .where(and(eq(communityMemberships.communityId, rows[0].id), eq(communityMemberships.userId, actor.id)));
}

/** The gate `createPost` runs before a post lands in a community. */
export async function assertCanPostInCommunity(userId: string, communityId: string): Promise<void> {
  const rows = await db
    .select({ archivedAt: communities.archivedAt })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  if (!rows[0]) throw notFound("Topluluk bulunamadı.");
  if (rows[0].archivedAt) throw conflict("Bu topluluk arşivlendi.");
  if (!(await isMemberOf(userId, communityId))) {
    throw forbidden("Bu toplulukta paylaşmak için önce katılın.");
  }
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const communitySchema = z.strictObject({
  name: z.string().trim().min(3, "Ad en az 3 karakter olmalı.").max(60),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function createCommunity(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string; slug: string }> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const parsed = communitySchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Topluluk bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const slug = slugify(parsed.data.name);
  if (slug === "") throw badRequest("Topluluk adı geçersiz.");

  const existing = await db.select({ id: communities.id }).from(communities).where(eq(communities.slug, slug)).limit(1);
  if (existing[0]) throw conflict("Bu adda bir topluluk zaten var.");

  const [row] = await db
    .insert(communities)
    .values({
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdBy: actor.id,
    })
    .returning({ id: communities.id, slug: communities.slug });

  await writeAudit({
    actorId: actor.id,
    action: "social.community_created",
    entityType: "communities",
    entityId: row!.id,
    after: { slug, name: parsed.data.name },
    ip: meta.ip,
  });

  return row!;
}

export async function archiveCommunity(actor: Actor, communityId: string, meta: RequestMeta): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();
  if (!z.uuid().safeParse(communityId).success) throw badRequest("Topluluk geçersiz.");

  const now = new Date();
  const updated = await db
    .update(communities)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(communities.id, communityId), isNull(communities.archivedAt)))
    .returning({ id: communities.id });
  if (updated.length === 0) throw notFound("Topluluk bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "social.community_archived",
    entityType: "communities",
    entityId: communityId,
    ip: meta.ip,
  });
}

/** Every community, archived ones last, with member counts. */
export async function listCommunitiesForAdmin(actor: Actor): Promise<CommunitySummary[]> {
  if (!canModerateCommunity(actor)) throw forbidden();
  const rows = await db
    .select(summaryColumns)
    .from(communities)
    .orderBy(asc(communities.archivedAt), desc(communities.createdAt));
  return withCounts(actor.id, rows);
}
