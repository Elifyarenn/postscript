/**
 * What the licence box gets back when it asks for the form (D-387). Shared by
 * the writer's and the çizer's preview actions.
 */
import "server-only";
import { isAppError } from "@/lib/errors";

export type LicencePreviewResult =
  | { ok: true; formId: string; textHash: string; html: string; illustrationId?: string }
  | { ok: false; error: string };

/** An app error's own message; anything else stays generic, as `runAction` does. */
export function licencePreviewFailure(error: unknown): LicencePreviewResult {
  if (isAppError(error)) return { ok: false, error: error.message };
  console.error("Licence preview failed:", error);
  return { ok: false, error: "Ruhsat formu açılamadı. Sayfayı yenileyip yeniden deneyin." };
}
