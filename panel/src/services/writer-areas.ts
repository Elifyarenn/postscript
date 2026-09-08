/**
 * Writing areas, backed by the `writer_areas` table (D-055).
 *
 * The public form reads the active areas with live quota; the admin panel
 * lists all of them and creates, renames, re-quotas, reorders, disables or
 * deletes. `users.writer_area` is plain text, so renaming an area keeps the
 * users in step inside the same transaction, and an area with writers on it
 * can be disabled but not deleted.
 */
import "server-only";
import { and, count, desc, eq, isNotNull, isNull, max, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { users, writerAreas } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { conflict, forbidden, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/auth/rbac";
import { canManageWriterAreas } from "@/lib/auth/rbac";
import type { RequestMeta } from "./auth";

type AreaRow = typeof writerAreas.$inferSelect;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Approved writers holding each area, as the quota counts them (D-052). */
async function countWritersByArea(): Promise<Map<string, number>> {
  const rows = await db
    .select({ area: users.writerArea, n: count() })
    .from(users)
    .where(and(eq(users.role, "writer"), isNull(users.deletedAt), isNotNull(users.writerArea)))
    .groupBy(users.writerArea);
  return new Map(rows.map((row) => [row.area as string, Number(row.n)]));
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

    // The users column is the area name; a rename must keep them in step
    if (nextName !== current.name) {
      await tx.update(users).set({ writerArea: nextName }).where(eq(users.writerArea, current.name));
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