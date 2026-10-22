/**
 * Signed contract files checked against the hash taken at upload (D-348).
 *
 * `signed_contracts.file_sha256` was written once and never read, so a file
 * replaced or damaged in storage would have gone unnoticed. The bytes are now
 * hashed again where it matters: before an admin verifies an upload, when the
 * archive is downloaded, and once a day for every file. A mismatch is never
 * repaired here — the stored copy is evidence, and only a person can decide
 * what happened to it — it is written to the audit log and the admins are told.
 */
import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { media, signedContracts, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { notify } from "./notifications";

export type FileCheck =
  | { ok: true }
  | { ok: false; kind: "missing" | "mismatch"; actual: string | null };

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Reads the stored object and compares its hash; a missing object is a failure too. */
export async function verifyStoredFile(mediaId: string, expectedSha256: string): Promise<FileCheck> {
  const [file] = await db.select({ storageKey: media.storageKey }).from(media).where(eq(media.id, mediaId)).limit(1);
  if (!file) return { ok: false, kind: "missing", actual: null };
  let body: Buffer;
  try {
    body = await getStorage().get({ bucket: "media", key: file.storageKey });
  } catch {
    return { ok: false, kind: "missing", actual: null };
  }
  const actual = sha256Hex(body);
  return actual === expectedSha256.toLowerCase() ? { ok: true } : { ok: false, kind: "mismatch", actual };
}

/** The audit entry for one failed check; the record is append-only, so it stays. */
export async function recordIntegrityFailure(
  signedContractId: string,
  mediaId: string,
  expected: string,
  check: Extract<FileCheck, { ok: false }>,
  where: "daily_check" | "verification" | "archive_download",
): Promise<void> {
  await writeAudit({
    actorId: null,
    action: "signed_contract.integrity_failed",
    entityType: "signed_contracts",
    entityId: signedContractId,
    after: { mediaId, kind: check.kind, expectedSha256: expected, actualSha256: check.actual, where },
    ip: null,
  });
}

/**
 * The daily run: every signed upload, whatever its status. The admins get one
 * notification listing how many failed, not one per file.
 */
export async function verifySignedContractFiles(): Promise<{ checked: number; failed: number }> {
  const rows = await db
    .select({ id: signedContracts.id, fileMediaId: signedContracts.fileMediaId, fileSha256: signedContracts.fileSha256 })
    .from(signedContracts);

  let failed = 0;
  for (const row of rows) {
    const check = await verifyStoredFile(row.fileMediaId, row.fileSha256);
    if (check.ok) continue;
    failed += 1;
    await recordIntegrityFailure(row.id, row.fileMediaId, row.fileSha256, check, "daily_check");
  }

  if (failed > 0) {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
    for (const admin of admins) {
      await notify({
        userId: admin.id,
        kind: "signed_contract.integrity_failed",
        title: `${failed} imzalı sözleşme dosyası doğrulanamadı`,
        body: "Depodaki dosya, yüklendiği anda alınan özetle eşleşmiyor ya da bulunamıyor. Ayrıntı denetim kaydında.",
        href: "/admin/audit",
      });
    }
  }

  return { checked: rows.length, failed };
}
