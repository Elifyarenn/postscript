import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { media, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";
import { badRequest } from "@/lib/errors";
import { MAX_PROFILE_IMAGE_BYTES } from "@/lib/profile-limits";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { assertMayPost } from "./community";
import { assertUploadAcceptable } from "./media";
import type { RequestMeta } from "./auth";

/**
 * The member's own two pictures (D-141): the profile picture and the cover
 * photo. Apart from article media, which an editor uploads and which needs a
 * licence, these belong to the member and carry none: they are the member's
 * own work by definition. The files sit in the same object storage, are
 * served only to signed-in members, and go when the account goes.
 */
export { MAX_PROFILE_IMAGE_BYTES };

export type ProfileImageKind = "avatar" | "header";

const COLUMN = { avatar: users.avatarMediaId, header: users.headerMediaId } as const;
export const PROFILE_IMAGE_LABEL = { avatar: "Profil fotoğrafı", header: "Kapak fotoğrafı" } as const;
const LABEL = PROFILE_IMAGE_LABEL;

/**
 * What a profile picture must pass before anything is stored: an image by its
 * content rather than its name, within the profile's own limit. Returns the
 * detected type. The one-save edit uses it too (D-160), so both refuse the same
 * files with the same words.
 */
export function assertProfileImage(buffer: Buffer, declaredMime: string): string {
  const detected = assertUploadAcceptable(buffer, declaredMime);
  if (detected.kind !== "image") throw badRequest("Yalnızca görsel yükleyebilirsiniz.");
  if (buffer.length > MAX_PROFILE_IMAGE_BYTES) {
    throw badRequest("Görsel çok büyük. Sınır: 5 MB.");
  }
  return detected.mime;
}

async function currentMediaId(userId: string, kind: ProfileImageKind): Promise<string | null> {
  const rows = await db
    .select({ avatar: users.avatarMediaId, header: users.headerMediaId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  return (kind === "avatar" ? row?.avatar : row?.header) ?? null;
}

/** Drops the old picture from the library and from storage; a profile keeps one of each. */
export async function discard(mediaId: string | null): Promise<void> {
  if (!mediaId) return;
  const rows = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  const row = rows[0];
  if (!row) return;
  await getStorage().remove({ bucket: "media", key: row.storageKey });
  await db.update(media).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(media.id, mediaId));
}

export async function setProfileImage(
  actor: Actor,
  input: { kind: ProfileImageKind; buffer: Buffer; fileName: string; declaredMime: string },
  meta: RequestMeta,
): Promise<string> {
  assertMayPost(actor);

  const detected = { mime: assertProfileImage(input.buffer, input.declaredMime) };

  const storageKey = buildStorageKey(`profile/${input.kind}`, input.fileName);
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
      // The member's own picture; article licence types do not apply (D-141)
      licenseType: "own_work",
      altText: LABEL[input.kind],
    })
    .returning({ id: media.id });

  const previous = await currentMediaId(actor.id, input.kind);
  await db
    .update(users)
    .set({ [input.kind === "avatar" ? "avatarMediaId" : "headerMediaId"]: row!.id, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
  await discard(previous);

  await writeAudit({
    actorId: actor.id,
    action: "user.profile_image_set",
    entityType: "users",
    entityId: actor.id,
    after: { kind: input.kind, mime: detected.mime, size: input.buffer.length },
    ip: meta.ip,
  });

  return row!.id;
}

export async function clearProfileImage(
  actor: Actor,
  kind: ProfileImageKind,
  meta: RequestMeta,
): Promise<void> {
  assertMayPost(actor);

  const previous = await currentMediaId(actor.id, kind);
  if (!previous) return;

  await db
    .update(users)
    .set({ [kind === "avatar" ? "avatarMediaId" : "headerMediaId"]: null, updatedAt: new Date() })
    .where(eq(users.id, actor.id));
  await discard(previous);

  await writeAudit({
    actorId: actor.id,
    action: "user.profile_image_cleared",
    entityType: "users",
    entityId: actor.id,
    after: { kind },
    ip: meta.ip,
  });
}

/** Both pictures go with the account, files included (D-141). */
export async function removeProfileImages(userId: string): Promise<void> {
  const rows = await db
    .select({ avatar: users.avatarMediaId, header: users.headerMediaId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  await discard(rows[0]?.avatar ?? null);
  await discard(rows[0]?.header ?? null);
}

/** True when the file is somebody's profile picture or cover photo. */
export async function isProfileImage(mediaId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.avatarMediaId, mediaId), eq(users.headerMediaId, mediaId)))
    .limit(1);
  return rows.length > 0;
}
