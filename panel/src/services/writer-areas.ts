/**
 * Writing areas, backed by the `writer_areas` table (D-055).
 *
 * The public form reads the active areas with live quota; the admin panel
 * lists all of them and creates, renames, re-quotas, reorders, disables or
 * deletes. `users.writer_area` / `users.writer_area_2` are plain text, so
 * renaming an area keeps the users in step inside the same transaction, and
 * an area with writers on it can be disabled but not deleted. A writer holds
 * at most two areas; the second one is assigned from the admin panel only
 * (D-057).
 */
import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, writerAreas, type User } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/auth/rbac";
import { canManageWriterAreas } from "@/lib/auth/rbac";
import { areaHasEditor } from "./editor-categories";
import type { RequestMeta } from "./auth";

type AreaRow = typeof writerAreas.$inferSelect;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * Approved writers holding each area, as the quota counts them (D-052,
 * D-057). A writer counts towards an area whether it is their first or second
 * one; `count(distinct user_id)` keeps a writer who holds the same name in
 * both slots from being counted twice.
 */
async function countWritersByArea(): Promise<Map<string, number>> {
  // postgres.js returns a bare array, PGlite an object with `rows`; both
  // drivers sit behind one `db` handle (D-002), so the shape is normalised.
  const result = (await db.execute(sql`
    select held.area as area, count(distinct held.user_id)::int as n
      from (
        select id as user_id, writer_area as area
          from users
         where role = 'writer' and deleted_at is null and writer_area is not null
        union all
        select id as user_id, writer_area_2 as area
          from users
         where role = 'writer' and deleted_at is null and writer_area_2 is not null
      ) held
     group by held.area
  `)) as { rows?: { area: string; n: number }[] } | { area: string; n: number }[];
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return new Map(rows.map((row) => [row.area, Number(row.n)]));
}

function withQuota(rows: AreaRow[], countByArea: Map<string, number>) {
  return rows.map((row) => {
    const currentCount = countByArea.get(row.name) ?? 0;
    return {
      id: row.id,
      name: row.name,
      quota: row.quota,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      currentCount,
      full: currentCount >= row.quota,
    };
  });
}

/** The active areas the public registration form offers, in hand order. */
export async function listWriterAreasWithQuota() {
  const rows = await db
    .select()
    .from(writerAreas)
    .where(eq(writerAreas.isActive, true))
    .orderBy(writerAreas.sortOrder);
  return withQuota(rows, await countWritersByArea());
}

/** Every area, active or not, newest-created last — the admin panel view. */
export async function listAllWriterAreasWithQuota() {
  const rows = await db
    .select()
    .from(writerAreas)
    .orderBy(writerAreas.sortOrder, desc(writerAreas.createdAt));
  return withQuota(rows, await countWritersByArea());
}

/* ------------------------------------------------------------------ */
/* Mutations (admin only; the actor check runs in the action)          */
/* ------------------------------------------------------------------ */

export async function createWriterArea(
  actor: Actor,
  input: { name: string; quota: number },
  meta: RequestMeta,
): Promise<AreaRow> {
  if (!canManageWriterAreas(actor)) throw forbidden();

  const name = input.name.trim();
  const duplicate = await db
    .select({ id: writerAreas.id })
    .from(writerAreas)
    .where(eq(writerAreas.name, name))
    .limit(1);
  if (duplicate.length > 0) throw conflict("Bu adla bir alan zaten var.");

  const maxOrder = await db.select({ max: max(writerAreas.sortOrder) }).from(writerAreas);
  const [row] = await db
    .insert(writerAreas)
    .values({
      name,
      quota: input.quota,
      sortOrder: (maxOrder[0]?.max ?? 0) + 1,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "writer_area.created",
    entityType: "writer_areas",
    entityId: row!.id,
    after: { name, quota: input.quota },
    ip: meta.ip,
  });

  return row!;
}

export async function updateWriterArea(
  actor: Actor,
  input: { id: string; name?: string; quota?: number; isActive?: boolean; sortOrder?: number },
  meta: RequestMeta,
): Promise<AreaRow> {
  if (!canManageWriterAreas(actor)) throw forbidden();

  const rows = await db.select().from(writerAreas).where(eq(writerAreas.id, input.id)).limit(1);
  const current = rows[0];
  if (!current) throw notFound("Alan bulunamadı.");

  const nextName = input.name === undefined ? current.name : input.name.trim();
  const nextQuota = input.quota ?? current.quota;

  if (nextName !== current.name) {
    const duplicate = await db
      .select({ id: writerAreas.id })
      .from(writerAreas)
      .where(and(eq(writerAreas.name, nextName), ne(writerAreas.id, input.id)))
      .limit(1);
    if (duplicate.length > 0) throw conflict("Bu adla bir alan zaten var.");
  }

  const countByArea = await countWritersByArea();
  const holders = countByArea.get(current.name) ?? 0;
  if (nextQuota < holders) {
    throw conflict(
      `Kontenjan ${holders} yazardan az olamaz (şu an ${holders} yazar bu alanda).`,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(writerAreas)
      .set({
        name: nextName,
        quota: nextQuota,
        isActive: input.isActive ?? current.isActive,
        sortOrder: input.sortOrder ?? current.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(writerAreas.id, current.id));

    // The users columns hold the area name; a rename must keep them in step
    if (nextName !== current.name) {
      await tx.update(users).set({ writerArea: nextName }).where(eq(users.writerArea, current.name));
      await tx
        .update(users)
        .set({ writerArea2: nextName })
        .where(eq(users.writerArea2, current.name));
    }
  });

  const updated = await db.select().from(writerAreas).where(eq(writerAreas.id, current.id)).limit(1);
  await writeAudit({
    actorId: actor.id,
    action: "writer_area.updated",
    entityType: "writer_areas",
    entityId: current.id,
    before: { name: current.name, quota: current.quota, isActive: current.isActive },
    after: { name: nextName, quota: nextQuota, isActive: input.isActive ?? current.isActive },
    ip: meta.ip,
  });

  return updated[0]!;
}

/**
 * Deletes an area nobody holds. An area with writers on it can only be
 * disabled — the writers keep their area name as history (D-055).
 */
export async function deleteWriterArea(
  actor: Actor,
  id: string,
  meta: RequestMeta,
): Promise<void> {
  if (!canManageWriterAreas(actor)) throw forbidden();

  const rows = await db.select().from(writerAreas).where(eq(writerAreas.id, id)).limit(1);
  const current = rows[0];
  if (!current) throw notFound("Alan bulunamadı.");

  const countByArea = await countWritersByArea();
  if ((countByArea.get(current.name) ?? 0) > 0) {
    throw conflict("Bu alanda yazarlar var; silmek yerine devre dışı bırakabilirsiniz.");
  }
  if (await areaHasEditor(current.id)) {
    throw conflict("Bu alan bir editöre atanmış; önce editör atamasını kaldırın.");
  }

  await db.delete(writerAreas).where(eq(writerAreas.id, current.id));
  await writeAudit({
    actorId: actor.id,
    action: "writer_area.deleted",
    entityType: "writer_areas",
    entityId: current.id,
    before: { name: current.name },
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* A writer's own areas (admin only, D-057)                            */
/* ------------------------------------------------------------------ */

export type WriterAreasInput = {
  /** First area; null clears it. */
  area: string | null;
  /** Second area; null clears it. */
  area2: string | null;
};

/**
 * An admin (re)assigns a writer's areas — the first one, the second one, or
 * both. Only the admin panel reaches this; the writer never edits their areas
 * themselves. Both values must be null or an existing area name, they must
 * differ, and a newly added area must have quota room, the same rule the
 * registration form enforces (D-052, D-057).
 */
export async function setWriterAreas(
  actor: Actor,
  userId: string,
  input: WriterAreasInput,
  meta: RequestMeta,
): Promise<User> {
  if (!canManageWriterAreas(actor)) throw forbidden();

  const area = input.area?.trim() || null;
  const area2 = input.area2?.trim() || null;
  if (area && area === area2) {
    throw badRequest("İki alan birbirinden farklı olmalı.");
  }

  const requested = [area, area2].filter((value): value is string => value !== null);
  const known = requested.length
    ? await db
        .select({ name: writerAreas.name, quota: writerAreas.quota })
        .from(writerAreas)
        .where(inArray(writerAreas.name, requested))
    : [];
  const knownByName = new Map(known.map((row) => [row.name, row]));
  for (const name of requested) {
    if (!knownByName.has(name)) throw badRequest(`"${name}" diye bir alan yok.`);
  }

  const targetRows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  const target = targetRows[0];
  if (!target) throw notFound("Kullanıcı bulunamadı.");
  if (target.role !== "writer") throw conflict("Alanlar yalnızca yazarlara atanabilir.");

  // A newly added area must have room; one the writer already holds does not
  // consume a fresh slot, so moving between areas needs no special handling.
  const countByArea = await countWritersByArea();
  const held = new Set([target.writerArea, target.writerArea2].filter((value): value is string => value !== null));
  for (const name of requested) {
    if (held.has(name)) continue;
    const areaRow = knownByName.get(name)!;
    if ((countByArea.get(name) ?? 0) >= areaRow.quota) {
      throw conflict(`"${name}" alanının kontenjanı dolu.`);
    }
  }

  const [updated] = await db
    .update(users)
    .set({ writerArea: area, writerArea2: area2, updatedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "user.writer_areas_changed",
    entityType: "users",
    entityId: target.id,
    before: { writerArea: target.writerArea, writerArea2: target.writerArea2 },
    after: { writerArea: area, writerArea2: area2 },
    ip: meta.ip,
  });

  return updated!;
}
