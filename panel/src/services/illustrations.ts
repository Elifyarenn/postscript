/**
 * Drawings a çizer hands in from their panel (D-362).
 *
 * Rules enforced here:
 *  - only an account with the çizer mark (D-151) that may open its panel uploads
 *  - JPEG, PNG or WEBP, told apart by their bytes, at most 4 MB: the host cuts a
 *    request off at about 4.5 MB before the action runs (D-254)
 *  - the çizer, the admins and the main editor see a drawing; nobody else
 *  - handing a drawing in publishes nothing and licenses nothing (FSEK)
 *  - removing one deletes the file and keeps the record for a year
 */
import "server-only";
import { createHash } from "node:crypto";
import { and, count, desc, eq, isNull, lt, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { illustrations, issues, users, type Illustration } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, canAccessIllustratorPanel, canReviewIllustrations, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { imageSize } from "@/lib/image-size";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { MAX_ILLUSTRATION_BYTES, MAX_ILLUSTRATION_MB } from "@/lib/illustration";
import { trafficCutoff } from "@/lib/traffic";
import { detectFileType } from "./media";
import { getEditorAssignment } from "./editor-categories";
import { notify } from "./notifications";
import type { RequestMeta } from "./auth";

/** Generous for a çizer's whole run, small enough that a stuck script cannot fill the bucket. */
export const MAX_ACTIVE_ILLUSTRATIONS = 200;

const ILLUSTRATION_MIMES = ["image/jpeg", "image/png", "image/webp"];

export const illustrationInputSchema = z.strictObject({
  title: z.string().trim().min(1, "Çizime bir ad verin.").max(200),
  note: z.string().trim().max(1000).optional().nullable(),
  issueId: z.uuid().optional().nullable(),
});

/** The mark is not on the session (D-288), so it is read from the account each time. */
async function assertIllustrator(actor: Actor): Promise<{ displayName: string }> {
  const [row] = await db
    .select({ isIllustrator: users.isIllustrator, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.id, actor.id), isNull(users.deletedAt)))
    .limit(1);
  if (!row || !canAccessIllustratorPanel(actor, row.isIllustrator)) throw forbidden();
  return { displayName: row.displayName };
}

/** Whether this person sees the drawings handed in; the page and the service ask the same. */
export async function mayReviewIllustrations(actor: Actor): Promise<boolean> {
  if (canAccessAdminPanel(actor)) return true;
  if (actor.role !== "editor") return false;
  return canReviewIllustrations(actor, await getEditorAssignment(actor.id));
}

/** The issues a çizer may say a drawing is for: not yet published, not the admins' sample. */
export async function listIssuesForIllustrations() {
  return db
    .select({ id: issues.id, number: issues.number, title: issues.title })
    .from(issues)
    .where(and(isNull(issues.deletedAt), ne(issues.status, "published"), eq(issues.adminOnly, false)))
    .orderBy(issues.number);
}

export async function uploadIllustration(
  actor: Actor,
  input: { buffer: Buffer; declaredMime: string; fileName: string; fields: unknown },
  meta: RequestMeta,
): Promise<Illustration> {
  const illustrator = await assertIllustrator(actor);

  const parsed = illustrationInputSchema.safeParse(input.fields);
  if (!parsed.success) {
    throw badRequest("Çizim bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const fields = parsed.data;

  const detected = detectFileType(input.buffer);
  if (!detected || !ILLUSTRATION_MIMES.includes(detected.mime)) {
    throw badRequest("Çizim JPEG, PNG ya da WEBP olmalı.");
  }
  // A mismatch means either a broken client or a disguised file; both are refused
  if (input.declaredMime && input.declaredMime !== detected.mime) {
    throw badRequest("Dosya içeriği bildirilen türle uyuşmuyor.");
  }
  if (input.buffer.length > MAX_ILLUSTRATION_BYTES) {
    throw badRequest(`Çizim çok büyük. Sınır: ${MAX_ILLUSTRATION_MB} MB.`);
  }

  if (fields.issueId) {
    const offered = await listIssuesForIllustrations();
    if (!offered.some((issue) => issue.id === fields.issueId)) {
      throw badRequest("Bu sayı için çizim gönderilemez.", { issueId: ["Listeden bir sayı seçin."] });
    }
  }

  const [active] = await db
    .select({ value: count() })
    .from(illustrations)
    .where(and(eq(illustrations.illustratorId, actor.id), isNull(illustrations.deletedAt)));
  if ((active?.value ?? 0) >= MAX_ACTIVE_ILLUSTRATIONS) {
    throw conflict(`En fazla ${MAX_ACTIVE_ILLUSTRATIONS} çizim tutulabilir; eskilerden kaldırıp yeniden deneyin.`);
  }

  const storageKey = buildStorageKey("illustrations", input.fileName);
  await getStorage().put({ bucket: "media", key: storageKey, body: input.buffer, mime: detected.mime });
  const size = imageSize(input.buffer, detected.mime);

  const [row] = await db
    .insert(illustrations)
    .values({
      illustratorId: actor.id,
      title: fields.title,
      note: fields.note ?? null,
      issueId: fields.issueId ?? null,
      storageKey,
      mime: detected.mime,
      size: input.buffer.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
    })
    .returning();

  // The IP sits in the audit row: who handed in which file from where (5651 m. 5 spirit)
  await writeAudit({
    actorId: actor.id,
    action: "illustration.uploaded",
    entityType: "illustrations",
    entityId: row!.id,
    after: { title: row!.title, mime: row!.mime, size: row!.size, sha256: row!.sha256 },
    ip: meta.ip,
  });

  await notifyReviewers(row!, actor.id, illustrator.displayName);
  return row!;
}

/** A panel notification for each admin and the main editor; no e-mail, so nothing queues. */
async function notifyReviewers(row: Illustration, uploaderId: string, uploaderName: string): Promise<void> {
  const reviewers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.isBanned, false),
        or(eq(users.role, "admin"), and(eq(users.role, "editor"), eq(users.isMainEditor, true))),
      ),
    );
  for (const reviewer of reviewers) {
    if (reviewer.id === uploaderId) continue;
    await notify({
      userId: reviewer.id,
      kind: "illustration_uploaded",
      title: "Yeni çizim yüklendi",
      body: `${uploaderName}: ${row.title}`,
      href: "/editor/cizimler",
    });
  }
}

export type IllustrationListItem = {
  id: string;
  title: string;
  note: string | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  issueNumber: number | null;
  illustratorId: string;
  illustratorName: string;
};

const listColumns = {
  id: illustrations.id,
  title: illustrations.title,
  note: illustrations.note,
  mime: illustrations.mime,
  size: illustrations.size,
  width: illustrations.width,
  height: illustrations.height,
  createdAt: illustrations.createdAt,
  issueNumber: issues.number,
  illustratorId: illustrations.illustratorId,
  illustratorName: users.displayName,
};

export async function listOwnIllustrations(actor: Actor): Promise<IllustrationListItem[]> {
  await assertIllustrator(actor);
  return db
    .select(listColumns)
    .from(illustrations)
    .innerJoin(users, eq(users.id, illustrations.illustratorId))
    .leftJoin(issues, eq(issues.id, illustrations.issueId))
    .where(and(eq(illustrations.illustratorId, actor.id), isNull(illustrations.deletedAt)))
    .orderBy(desc(illustrations.createdAt));
}

/** Every drawing still held, newest first; the page groups them by çizer. */
export async function listIllustrationsForReview(actor: Actor): Promise<IllustrationListItem[]> {
  if (!(await mayReviewIllustrations(actor))) throw forbidden();
  return db
    .select(listColumns)
    .from(illustrations)
    .innerJoin(users, eq(users.id, illustrations.illustratorId))
    .leftJoin(issues, eq(issues.id, illustrations.issueId))
    .where(isNull(illustrations.deletedAt))
    .orderBy(desc(illustrations.createdAt));
}

/** The file, for the çizer who handed it in and for the reviewers; 404 for anyone else. */
export async function readIllustrationFile(
  actor: Actor,
  illustrationId: string,
): Promise<{ body: Buffer; mime: string; title: string }> {
  const [row] = await db
    .select()
    .from(illustrations)
    .where(and(eq(illustrations.id, illustrationId), isNull(illustrations.deletedAt)))
    .limit(1);
  // Not found and not allowed answer alike, so the ids say nothing about who drew what
  if (!row) throw notFound("Çizim bulunamadı.");
  if (row.illustratorId !== actor.id && !(await mayReviewIllustrations(actor))) throw notFound("Çizim bulunamadı.");

  const body = await getStorage().get({ bucket: "media", key: row.storageKey });
  return { body, mime: row.mime, title: row.title };
}

/**
 * Takes a drawing back: the çizer their own, an admin anyone's (the removal
 * path every user upload needs). The row stays as the record; the file goes.
 */
export async function removeIllustration(actor: Actor, illustrationId: string, meta: RequestMeta): Promise<void> {
  const [row] = await db
    .select()
    .from(illustrations)
    .where(and(eq(illustrations.id, illustrationId), isNull(illustrations.deletedAt)))
    .limit(1);
  if (!row) throw notFound("Çizim bulunamadı.");
  const own = row.illustratorId === actor.id;
  if (!own && !canAccessAdminPanel(actor)) throw notFound("Çizim bulunamadı.");
  if (own) await assertIllustrator(actor);

  // Conditional, so two removals at once cannot both write the record
  const [removed] = await db
    .update(illustrations)
    .set({ deletedAt: new Date(), deletedBy: actor.id, updatedAt: new Date() })
    .where(and(eq(illustrations.id, illustrationId), isNull(illustrations.deletedAt)))
    .returning({ id: illustrations.id });
  if (!removed) throw notFound("Çizim bulunamadı.");

  await getStorage().remove({ bucket: "media", key: row.storageKey });

  await writeAudit({
    actorId: actor.id,
    action: "illustration.removed",
    entityType: "illustrations",
    entityId: row.id,
    before: { title: row.title, illustratorId: row.illustratorId, sha256: row.sha256 },
    after: { removedBy: own ? "illustrator" : "admin" },
    ip: meta.ip,
  });
}

/**
 * A deleted account's drawings leave storage with it, as its profile pictures
 * do (D-141); the rows stay as the record of what was handed in. Called by the
 * anonymisation, which writes its own audit row.
 */
export async function removeIllustrationsOfAccount(userId: string): Promise<void> {
  const rows = await db
    .update(illustrations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(illustrations.illustratorId, userId), isNull(illustrations.deletedAt)))
    .returning({ storageKey: illustrations.storageKey });
  for (const row of rows) {
    await getStorage().remove({ bucket: "media", key: row.storageKey });
  }
}

/** The çizer's own drawings for the KVKK export: what they handed in, not where it is stored. */
export async function exportIllustrationsOf(userId: string) {
  return db
    .select({
      id: illustrations.id,
      title: illustrations.title,
      note: illustrations.note,
      issueId: illustrations.issueId,
      mime: illustrations.mime,
      size: illustrations.size,
      width: illustrations.width,
      height: illustrations.height,
      sha256: illustrations.sha256,
      createdAt: illustrations.createdAt,
      deletedAt: illustrations.deletedAt,
    })
    .from(illustrations)
    .where(eq(illustrations.illustratorId, userId))
    .orderBy(desc(illustrations.createdAt));
}

/**
 * KVKK notice §7: a removed drawing's record (its name, note, hash) stays one
 * year after the removal, as removed community content does, then goes.
 * The file left at the removal itself.
 */
export async function pruneRemovedIllustrations(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(illustrations)
    .where(lt(illustrations.deletedAt, trafficCutoff(now)))
    .returning({ id: illustrations.id });
  return removed.length;
}
