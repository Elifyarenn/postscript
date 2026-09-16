import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { media, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/rbac";
import { badRequest, isAppError } from "@/lib/errors";
import { MAX_BIO_LENGTH } from "@/lib/profile-limits";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { assertMayPost } from "./community";
import {
  assertProfileImage,
  discard,
  PROFILE_IMAGE_LABEL,
  type ProfileImageKind,
} from "./profile-images";
import type { RequestMeta } from "./auth";

/**
 * The profile edited the way X edits it (D-160): one dialog, one save. The
 * bio and both pictures arrive together and are kept together: either every
 * change lands or none does.
 *
 * There is no separate community name: the member goes by the handle chosen
 * in the settings (D-166), so the dialog has no name field. The pen name is
 * the magazine's and not part of it (D-162): it is changed on the account
 * page, this save never reads or writes it, and a member saving a new photo
 * cannot lose it.
 *
 * Every check runs before anything is written, and every problem is reported
 * at once. The new files go to storage first; the database changes in one
 * transaction; the replaced files are removed only after it commits, so a
 * failed save never leaves a profile pointing at a deleted picture.
 */

export type PictureChange =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "replace"; buffer: Buffer; fileName: string; declaredMime: string };

export type ProfileEdit = {
  bio: string;
  avatar: PictureChange;
  header: PictureChange;
};

const profileTextSchema = z.strictObject({
  bio: z.string().trim().max(MAX_BIO_LENGTH, `Biyografi en fazla ${MAX_BIO_LENGTH} karakter olabilir.`),
});

const KINDS: ProfileImageKind[] = ["avatar", "header"];

/** The form field each picture's problem is reported under, the dialog's input name. */
const IMAGE_FIELD = { avatar: "avatarImage", header: "headerImage" } as const;

export async function updateProfile(
  actor: Actor,
  input: ProfileEdit,
  meta: RequestMeta,
): Promise<{ bio: string | null }> {
  assertMayPost(actor);

  const fieldErrors: Record<string, string[]> = {};

  // --- 1. Every check, before any write ---
  const parsed = profileTextSchema.safeParse({ bio: input.bio });
  if (!parsed.success) Object.assign(fieldErrors, z.flattenError(parsed.error).fieldErrors);
  const bio = parsed.success ? parsed.data.bio || null : null;

  const detectedMime: Partial<Record<ProfileImageKind, string>> = {};
  for (const kind of KINDS) {
    const change = input[kind];
    if (change.action !== "replace") continue;
    try {
      detectedMime[kind] = assertProfileImage(change.buffer, change.declaredMime);
    } catch (error) {
      if (!isAppError(error)) throw error;
      fieldErrors[IMAGE_FIELD[kind]] = [error.message];
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw badRequest("Profil kaydedilmedi. İşaretli alanları düzeltip yeniden deneyin.", fieldErrors);
  }

  // --- 2. New files into storage; nothing points at them yet ---
  const uploaded: { kind: ProfileImageKind; storageKey: string; mime: string; size: number }[] = [];
  const storage = getStorage();
  let replaced: string[];
  try {
    for (const kind of KINDS) {
      const change = input[kind];
      if (change.action !== "replace") continue;
      const storageKey = buildStorageKey(`profile/${kind}`, change.fileName);
      const mime = detectedMime[kind]!;
      await storage.put({ bucket: "media", key: storageKey, body: change.buffer, mime });
      uploaded.push({ kind, storageKey, mime, size: change.buffer.length });
    }

    // --- 3. One transaction for every column the dialog touches ---
    replaced = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ avatar: users.avatarMediaId, header: users.headerMediaId })
        .from(users)
        .where(eq(users.id, actor.id))
        .limit(1);

      const pictures: { avatarMediaId?: string | null; headerMediaId?: string | null } = {};
      const outgoing: string[] = [];

      for (const kind of KINDS) {
        const change = input[kind];
        const previous = current?.[kind] ?? null;
        const column = kind === "avatar" ? "avatarMediaId" : "headerMediaId";

        if (change.action === "replace") {
          const file = uploaded.find((item) => item.kind === kind)!;
          const [row] = await tx
            .insert(media)
            .values({
              storageKey: file.storageKey,
              mime: file.mime,
              size: file.size,
              uploadedBy: actor.id,
              // The member's own picture; article licence types do not apply (D-141)
              licenseType: "own_work",
              altText: PROFILE_IMAGE_LABEL[kind],
            })
            .returning({ id: media.id });
          pictures[column] = row!.id;
          if (previous) outgoing.push(previous);
          await writeAudit(
            {
              actorId: actor.id,
              action: "user.profile_image_set",
              entityType: "users",
              entityId: actor.id,
              after: { kind, mime: file.mime, size: file.size },
              ip: meta.ip,
            },
            tx,
          );
        } else if (change.action === "remove" && previous) {
          pictures[column] = null;
          outgoing.push(previous);
          await writeAudit(
            {
              actorId: actor.id,
              action: "user.profile_image_cleared",
              entityType: "users",
              entityId: actor.id,
              after: { kind },
              ip: meta.ip,
            },
            tx,
          );
        }
      }

      await tx
        .update(users)
        .set({ bio, ...pictures, updatedAt: new Date() })
        .where(eq(users.id, actor.id));

      return outgoing;
    });
  } catch (error) {
    // The save failed after some files were stored: they belong to nothing, so they go
    for (const file of uploaded) {
      await storage.remove({ bucket: "media", key: file.storageKey }).catch(() => undefined);
    }
    throw error;
  }

  // --- 4. Only now, with the profile committed, do the old files go. Outside the
  // try above: the new files are in use from here on and must never be cleaned up ---
  for (const mediaId of replaced) await discard(mediaId);

  return { bio };
}
