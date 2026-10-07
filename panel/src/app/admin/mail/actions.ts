"use server";

/**
 * The e-mail outbox's two buttons (D-269), for the admins and the main
 * editor (D-330). Each re-checks the role, the main-editor mark and
 * the CSRF token; the page having rendered proves nothing.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { processMailQueueAsAdmin, retryMailJob } from "@/services/mail-queue";

export async function processMailQueueAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    // An editor gets this far; the service lets only the main editor through (D-330)
    const { user } = await requireRole("editor");

    const result = await processMailQueueAsAdmin({ ...user });
    revalidatePath("/admin/mail");
    revalidatePath("/editor/mail");
    const rest = result.skipped > 0 ? ` Süreye sığmayan ${result.skipped} ileti sonraki çalışmada.` : "";
    return {
      success: `Gönderilen: ${result.sent}, yeniden denenecek: ${result.retrying}, başarısız: ${result.failed}.${rest}`,
    };
  });
}

export async function retryMailJobAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    // An editor gets this far; the service lets only the main editor through (D-330)
    const { user } = await requireRole("editor");
    const meta = await requestMetadata();

    await retryMailJob({ ...user }, text(formData, "jobId"), meta);
    revalidatePath("/admin/mail");
    revalidatePath("/editor/mail");
    return { success: "E-posta yeniden kuyruğa alındı." };
  });
}
