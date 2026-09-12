/**
 * Editor area assignments (D-059).
 *
 * An editor is responsible for at most two of the magazine's areas ("1. alan"
 * and "2. alan"), and one area belongs to exactly one editor. The first rule
 * is enforced here (the database cannot count rows for a unique index), the
 * second one is a database unique index on `editor_categories.area_id` — the
 * service pre-checks it anyway so the admin gets a readable conflict instead
 * of a raw unique violation.
 *
 * A main editor (`users.is_main_editor`) reads every category and approves the
 * second review stage; a plain editor only sees the areas assigned here.
 */
import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { editorCategories, users, writerAreas, type EditorCategory } from "@/db/schema";
import { writeAudit, type Executor } from "@/lib/audit";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { canManageUsers, type Actor, type EditorAssignment } from "@/lib/auth/rbac";
import type { RequestMeta } from "./auth";

type EditorCategoryRow = typeof editorCategories.$inferSelect;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/**
 * The scope a reviewer acts with: their main-editor flag plus the names of
 * the areas in `editor_categories`. Admins and non-editors get an empty scope
 * (their role decides what they may see instead).
 */
export async function getEditorAssignment(userId: string): Promise<EditorAssignment> {
  const userRows = await db
    .select({ role: users.role, isMainEditor: users.isMainEditor })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user || user.role !== "editor") {
    return { isMainEditor: false, assignedAreas: [] };
  }

  const rows = await db
    .select({ name: writerAreas.name })
    .from(editorCategories)
    .innerJoin(writerAreas, eq(editorCategories.areaId, writerAreas.id))
    .where(eq(editorCategories.editorId, userId))
    .orderBy(editorCategories.slot);

  return { isMainEditor: user.isMainEditor, assignedAreas: rows.map((row) => row.name) };
}

/** An area, annotated with the editor who currently holds it, if any. */
export type EditorAreaRow = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  holderEditorId: string | null;
  holderEditorName: string | null;
};

/**
 * Every area with its current holder. The admin assignment form uses this to
 * disable areas that belong to another editor and to say who holds them.
 */
export async function listEditorAreasWithHolders(): Promise<EditorAreaRow[]> {
  const rows = await db
    .select({
      id: writerAreas.id,
      name: writerAreas.name,
      isActive: writerAreas.isActive,
      sortOrder: writerAreas.sortOrder,
      editorId: editorCategories.editorId,
      editorName: users.displayName,
    })
    .from(writerAreas)
    .leftJoin(editorCategories, eq(editorCategories.areaId, writerAreas.id))
    .leftJoin(users, eq(editorCategories.editorId, users.id))
    .orderBy(writerAreas.sortOrder);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    holderEditorId: row.editorId ?? null,
    holderEditorName: row.editorName ?? null,
  }));
}

/** The areas an editor already holds, keyed by slot. */
export async function listEditorCategories(editorId: string): Promise<EditorCategory[]> {
  return db
    .select()
    .from(editorCategories)
    .where(eq(editorCategories.editorId, editorId))
    .orderBy(editorCategories.slot);
}

/* ------------------------------------------------------------------ */
/* Mutations (admin only)                                              */
/* ------------------------------------------------------------------ */

export type EditorDutiesInput = {
  /** Area ids for slot 1 and 2; null clears the slot. */
  areaId: string | null;
  areaId2: string | null;
  /** A main editor reviews every category and approves the second stage. */
  isMainEditor: boolean;
};

/**
 * (Re)assigns an editor's duties in one step: their first and second area and
 * whether they are the main editor. Only the admin panel reaches this.
 *
 * Rules: the target must be an editor, the two areas must differ, an area
 * cannot be given to a second editor (unique index + readable pre-check), and
 * the editor holds at most two slots — which this form enforces by replacing
 * the rows rather than appending.
 */
export async function setEditorDuties(
  actor: Actor,
  userId: string,
  input: EditorDutiesInput,
  meta: RequestMeta,
): Promise<EditorCategoryRow[]> {
  if (!canManageUsers(actor)) throw forbidden();

  const targetRows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  const target = targetRows[0];
  if (!target) throw notFound("Kullanıcı bulunamadı.");
  if (target.role !== "editor") throw conflict("Alan ataması yalnızca editörlere yapılır.");

  const areaIds = [input.areaId, input.areaId2].filter((value): value is string => value !== null);
  if (input.areaId && input.areaId === input.areaId2) {
    throw badRequest("İki alan birbirinden farklı olmalı.");
  }

  const knownRows = areaIds.length
    ? await db
        .select({ id: writerAreas.id, name: writerAreas.name, isActive: writerAreas.isActive })
        .from(writerAreas)
        .where(inArray(writerAreas.id, areaIds))
    : [];
  const knownById = new Map(knownRows.map((row) => [row.id, row]));
  for (const areaId of areaIds) {
    const area = knownById.get(areaId);
    if (!area) throw badRequest("Seçilen alan bulunamadı.");
    if (!area.isActive) throw conflict(`"${area.name}" alanı devre dışı; önce etkinleştirin.`);
  }

  // The requested unique constraint, checked for a readable error message:
  // an area another editor holds may not be handed over here.
  const held = areaIds.length
    ? await db
        .select({ editorId: editorCategories.editorId })
        .from(editorCategories)
        .where(inArray(editorCategories.areaId, areaIds))
    : [];
  const heldByOther = held.find((row) => row.editorId !== target.id);
  if (heldByOther) {
    const area = knownById.get(areaIds.find((id) => id !== null)!)!;
    throw conflict(
      `"${area.name}" alanı başka bir editöre atanmış. Her alanın tek bir editörü olabilir.`,
    );
  }

  const duties = await db.transaction(async (tx) => {
    await tx
      .delete(editorCategories)
      .where(eq(editorCategories.editorId, target.id));

    const rows: EditorCategoryRow[] = [];
    const slots: Array<{ slot: number; areaId: string | null }> = [
      { slot: 1, areaId: input.areaId },
      { slot: 2, areaId: input.areaId2 },
    ];
    for (const slot of slots) {
      if (!slot.areaId) continue;
      const [row] = await tx
        .insert(editorCategories)
        .values({ editorId: target.id, areaId: slot.areaId, slot: slot.slot })
        .returning();
      rows.push(row!);
    }

    const previousMain = await tx
      .select({ isMainEditor: users.isMainEditor })
      .from(users)
      .where(eq(users.id, target.id))
      .limit(1);

    if (input.isMainEditor !== previousMain[0]?.isMainEditor) {
      await tx
        .update(users)
        .set({ isMainEditor: input.isMainEditor, updatedAt: new Date() })
        .where(eq(users.id, target.id));
    }

    return rows;
  });

  await writeAudit({
    actorId: actor.id,
    action: "user.editor_duties_changed",
    entityType: "users",
    entityId: target.id,
    before: {
      isMainEditor: target.isMainEditor,
      areaIds: await currentAreaIds(target.id),
    },
    after: { isMainEditor: input.isMainEditor, areaIds },
    ip: meta.ip,
  });

  return duties;
}

/** The area ids currently assigned to an editor, for the audit diff. */
async function currentAreaIds(editorId: string): Promise<string[]> {
  const rows = await db
    .select({ areaId: editorCategories.areaId })
    .from(editorCategories)
    .where(eq(editorCategories.editorId, editorId));
  return rows.map((row) => row.areaId);
}

/**
 * Whether an area may be deleted: nobody holds it. Writer-area deletion
 * already blocks on writers; an assigned editor blocks it the same way (the
 * foreign key would refuse it anyway, this is the readable message).
 */
export async function areaHasEditor(areaId: string): Promise<boolean> {
  const rows = await db
    .select({ id: editorCategories.id })
    .from(editorCategories)
    .where(eq(editorCategories.areaId, areaId))
    .limit(1);
  return rows.length > 0;
}

/** Selectable categories for an author's own submissions: the areas they hold. */
export async function selectableWriterCategories(actor: Actor): Promise<string[]> {
  const userRows = await db
    .select({
      writerArea: users.writerArea,
      writerArea2: users.writerArea2,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1);
  const user = userRows[0];
  if (!user) return [];

  const names = new Set<string>();
  if (user.writerArea) names.add(user.writerArea);
  if (user.writerArea2) names.add(user.writerArea2);
  if (user.role === "editor") {
    const assignment = await getEditorAssignment(actor.id);
    for (const name of assignment.assignedAreas) names.add(name);
  }

  // Only live areas are offered; a disabled area keeps its writers as history
  if (names.size === 0) return [];
  const rows = await db
    .select({ name: writerAreas.name })
    .from(writerAreas)
    .where(and(eq(writerAreas.isActive, true), inArray(writerAreas.name, [...names])))
    .orderBy(writerAreas.sortOrder);
  return rows.map((row) => row.name);
}

/** Sanity check helper used by tests: whether an area id maps to a live area. */
export async function areaExists(areaId: string): Promise<boolean> {
  const rows = await db
    .select({ id: writerAreas.id })
    .from(writerAreas)
    .where(eq(writerAreas.id, areaId))
    .limit(1);
  return rows.length > 0;
}

/** Deletes an editor's area rows; used when an editor loses the role. */
export async function clearEditorAreas(
  editorId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(editorCategories).where(eq(editorCategories.editorId, editorId));
}