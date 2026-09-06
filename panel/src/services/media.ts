/**
 * Media library and upload validation (§9.2 and §11).
 *
 * Rules enforced here:
 *  - the declared MIME type must match the file's magic bytes
 *  - images are capped at 10 MB, PDFs at 20 MB
 *  - the stored file name is generated on the server, never taken from the user
 *  - media without a `license_type` can never be attached to an article
 */
import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articleMedia, media, type LicenseType, type MediaRow } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, canViewIdentityDocuments, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { buildStorageKey, getStorage } from "@/lib/storage";
import type { RequestMeta } from "./auth";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Signatures long enough to be meaningful, checked against the first bytes. */
const MAGIC_BYTES: { mime: string; kind: "image" | "pdf"; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    kind: "image",
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { mime: "image/gif", kind: "image", test: (b) => b.subarray(0, 6).toString("ascii").startsWith("GIF8") },
  {
    mime: "image/webp",
    kind: "image",
    test: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { mime: "application/pdf", kind: "pdf", test: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
];

export type DetectedType = { mime: string; kind: "image" | "pdf" };

/** Returns the real type of the bytes, ignoring whatever the client claimed. */
export function detectFileType(buffer: Buffer): DetectedType | null {
  if (buffer.length < 12) return null;
  const match = MAGIC_BYTES.find((candidate) => candidate.test(buffer));
  return match ? { mime: match.mime, kind: match.kind } : null;
}

export function assertUploadAcceptable(buffer: Buffer, declaredMime: string): DetectedType {
  const detected = detectFileType(buffer);
  if (!detected) {
    throw badRequest("Dosya türü tanınmadı. Yalnızca JPEG, PNG, GIF, WEBP ve PDF kabul edilir.");
  }
  // A mismatch means either a broken client or a disguised file; both are refused
  if (declaredMime && declaredMime !== detected.mime) {
    throw badRequest("Dosya içeriği bildirilen türle uyuşmuyor.");
  }

  const limit = detected.kind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (buffer.length > limit) {
    throw badRequest(
      `Dosya çok büyük. Sınır: ${detected.kind === "pdf" ? "20" : "10"} MB.`,
    );
  }
  return detected;
}

/* ------------------------------------------------------------------ */
/* Creating media                                                      */
/* ------------------------------------------------------------------ */

export const mediaLicenseSchema = z.strictObject({
  licenseType: z.enum([
    "own_work",
    "cc0",
    "cc_by",
    "stock_licensed",
    "permission_letter",
    "contract_pdf",
    "other",
  ]),
  licenseSource: z.string().trim().max(500).optional().nullable(),
  altText: z.string().trim().max(300).optional().nullable(),
});

export async function uploadMedia(
  actor: Actor,
  input: {
    buffer: Buffer;
    fileName: string;
    declaredMime: string;
    license: unknown;
  },
  meta: RequestMeta,
): Promise<MediaRow> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const detected = assertUploadAcceptable(input.buffer, input.declaredMime);
  const parsed = mediaLicenseSchema.safeParse(input.license);
  if (!parsed.success) {
    throw badRequest("Lisans bilgisi eksik.", z.flattenError(parsed.error).fieldErrors);
  }

  const storageKey = buildStorageKey("media", input.fileName);
  await getStorage().put({
    bucket: "media",
    key: storageKey,
    body: input.buffer,
    mime: detected.mime,
  });

  const [row] = await db
    .insert(media)
    .values({
      storageKey,
      mime: detected.mime,
      size: input.buffer.length,
      uploadedBy: actor.id,
      licenseType: parsed.data.licenseType,
      licenseSource: parsed.data.licenseSource ?? null,
      altText: parsed.data.altText ?? null,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "media.uploaded",
    entityType: "media",
    entityId: row!.id,
    after: { mime: detected.mime, size: input.buffer.length, licenseType: parsed.data.licenseType },
    ip: meta.ip,
  });

  return row!;
}

/**
 * Identity documents go to their own bucket, are flagged, and are scheduled for
 * deletion 90 days later (DECISIONS.md D-009).
 */
export async function uploadIdentityDocument(
  actor: Actor,
  input: { buffer: Buffer; fileName: string; declaredMime: string; subjectUserId: string },
  meta: RequestMeta,
): Promise<MediaRow> {
  if (!canViewIdentityDocuments(actor)) throw forbidden();

  const detected = assertUploadAcceptable(input.buffer, input.declaredMime);
  const storageKey = buildStorageKey(`identity/${input.subjectUserId}`, input.fileName);

  await getStorage().put({
    bucket: "identity",
    key: storageKey,
    body: input.buffer,
    mime: detected.mime,
  });

  const [row] = await db
    .insert(media)
    .values({
      storageKey,
      mime: detected.mime,
      size: input.buffer.length,
      uploadedBy: input.subjectUserId,
      licenseType: "other",
      isIdentityDocument: true,
      autoDeleteAt: new Date(Date.now() + 90 * 86_400_000),
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "media.identity_document_uploaded",
    entityType: "media",
    entityId: row!.id,
    // The storage key is deliberately not recorded: §11 keeps it out of the logs
    after: { subjectUserId: input.subjectUserId, mime: detected.mime },
    ip: meta.ip,
  });

  return row!;
}

/** Stores a PDF the system generated itself (agreements, rights grant forms). */
export async function storeGeneratedPdf(
  buffer: Buffer,
  input: { prefix: string; fileName: string; uploadedBy: string | null },
): Promise<MediaRow> {
  const storageKey = buildStorageKey(input.prefix, input.fileName);
  await getStorage().put({
    bucket: "media",
    key: storageKey,
    body: buffer,
    mime: "application/pdf",
  });

  const [row] = await db
    .insert(media)
    .values({
      storageKey,
      mime: "application/pdf",
      size: buffer.length,
      uploadedBy: input.uploadedBy,
      licenseType: "contract_pdf",
    })
    .returning();

  return row!;
}

/* ------------------------------------------------------------------ */
/* Library and article links                                           */
/* ------------------------------------------------------------------ */

export async function listMedia(actor: Actor, limit = 60, offset = 0) {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  return db
    .select()
    .from(media)
    .where(and(isNull(media.deletedAt), eq(media.isIdentityDocument, false)))
    .orderBy(desc(media.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Which articles use a given media row; shown in the library (§9.2). */
export async function articlesUsingMedia(mediaId: string): Promise<string[]> {
  const rows = await db
    .select({ articleId: articleMedia.articleId })
    .from(articleMedia)
    .where(eq(articleMedia.mediaId, mediaId));
  return rows.map((row) => row.articleId);
}

export async function attachMediaToArticle(
  actor: Actor,
  articleId: string,
  mediaId: string,
  role = "inline",
): Promise<void> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const rows = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Görsel bulunamadı.");

  // §4: a media row without a license type may not be attached to an article
  if (!row.licenseType) {
    throw badRequest("Lisans bilgisi girilmemiş görsel makaleye eklenemez.");
  }

  await db
    .insert(articleMedia)
    .values({ articleId, mediaId, role })
    .onConflictDoNothing();
}

export async function detachMediaFromArticle(
  actor: Actor,
  articleId: string,
  mediaId: string,
): Promise<void> {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  await db
    .delete(articleMedia)
    .where(and(eq(articleMedia.articleId, articleId), eq(articleMedia.mediaId, mediaId)));
}

/**
 * The guard the state machine consults before scheduling: true when every
 * attached media row carries a license type.
 */
export async function allMediaLicensed(articleId: string): Promise<boolean> {
  const rows = await db
    .select({ missing: sql<number>`count(*)` })
    .from(articleMedia)
    .innerJoin(media, eq(articleMedia.mediaId, media.id))
    .where(and(eq(articleMedia.articleId, articleId), isNull(media.licenseType)));

  return Number(rows[0]?.missing ?? 0) === 0;
}

export async function findMediaByIds(ids: string[]): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(media).where(inArray(media.id, ids));
}

/** Sets or corrects the license fields of an existing media row. */
export async function updateMediaLicense(
  actor: Actor,
  mediaId: string,
  license: { licenseType: LicenseType; licenseSource?: string | null; altText?: string | null },
  meta: RequestMeta,
): Promise<MediaRow> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const [row] = await db
    .update(media)
    .set({
      licenseType: license.licenseType,
      licenseSource: license.licenseSource ?? null,
      altText: license.altText ?? null,
      updatedAt: new Date(),
    })
    .where(eq(media.id, mediaId))
    .returning();

  if (!row) throw notFound("Görsel bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "media.license_updated",
    entityType: "media",
    entityId: mediaId,
    after: { licenseType: license.licenseType },
    ip: meta.ip,
  });

  return row;
}
