"use server";

/**
 * The e-mail outbox's two buttons (D-269). Each re-checks the admin role and
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
    const { user } = await requireRole("admin");

    const result = await processMailQueueAsAdmin({ ...user });
    revalidatePath("/admin/mail");
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
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await retryMailJob({ ...user }, text(formData, "jobId"), meta);
    revalidatePath("/admin/mail");
    return { success: "E-posta yeniden kuyruğa alındı." };
  });
}
