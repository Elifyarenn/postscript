"use server";

/**
 * Moderation actions for member posts and content reports (D-090). The older
 * comment, chat and blacklist actions stay in `src/app/admin/actions.ts`.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { removePostAsModerator } from "@/services/posts";
import { resolveReport } from "@/services/reports";
import { archiveCommunity, createCommunity } from "@/services/communities";

export async function createCommunityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const created = await createCommunity(
      { ...user },
      { name: text(formData, "name"), description: text(formData, "description") || null },
      meta,
    );

    revalidatePath("/admin/community", "layout");
    revalidatePath("/social", "layout");
    return { success: `Topluluk açıldı: /social/communities/${created.slug}` };
  });
}

export async function archiveCommunityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await archiveCommunity({ ...user }, text(formData, "communityId"), meta);

    revalidatePath("/admin/community", "layout");
    revalidatePath("/social", "layout");
    return { success: "Topluluk arşivlendi." };
  });
}

export async function resolveReportAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await resolveReport(
      { ...user },
      {
        reportId: text(formData, "reportId"),
        decision: text(formData, "decision"),
        note: text(formData, "note") || null,
      },
      meta,
    );

    revalidatePath("/admin/community", "layout");
    revalidatePath("/social", "layout");
    return { success: "Bildirim sonuçlandırıldı." };
  });
}

export async function removePostAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    await removePostAsModerator({ ...user }, text(formData, "postId"), meta);

    revalidatePath("/admin/community", "layout");
    revalidatePath("/social", "layout");
    return { success: "Gönderi kaldırıldı." };
  });
}
