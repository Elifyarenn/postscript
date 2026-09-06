/**
 * Deletes identity documents whose 90 day retention has expired
 * (DECISIONS.md D-009).
 *
 * The file is removed from object storage and the row is marked `purged_at`.
 * `users.identity_verified_at` is left alone: the fact that verification
 * happened is kept, the document behind it is not.
 *
 * Suggested cron: once a day.
 */
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { media } from "@/db/schema";
import { getStorage } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const now = new Date();

  const expired = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .where(
      and(
        eq(media.isIdentityDocument, true),
        isNull(media.purgedAt),
        lte(media.autoDeleteAt, now),
      ),
    );

  if (expired.length === 0) {
    console.log("No identity documents were due for deletion.");
    return;
  }

  const storage = getStorage();

  for (const document of expired) {
    try {
      await storage.remove({ bucket: "identity", key: document.storageKey });
    } catch (error) {
      // A file already gone is fine; anything else is worth seeing in the log
      console.warn(`Could not remove object for media ${document.id}:`, error);
    }

    await db
      .update(media)
      .set({ purgedAt: now, deletedAt: now, updatedAt: now })
      .where(eq(media.id, document.id));

    await writeAudit({
      actorId: null,
      action: "media.identity_document_purged",
      entityType: "media",
      entityId: document.id,
      ip: null,
    });
  }

  console.log(`Purged ${expired.length} identity document(s).`);
});
