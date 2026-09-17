"use server";

/**
 * Team avatar builder actions (D-194): CSRF check → session → service →
 * revalidate. The service repeats the team check and every validation; the
 * browser's copy of the rules only makes the form friendlier.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { badRequest } from "@/lib/errors";
import { deleteOwnTeamAvatar, saveTeamAvatar } from "@/services/team-avatars";

export async function saveTeamAvatarAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    let config: unknown;
    try {
      config = JSON.parse(text(formData, "config"));
    } catch {
      throw badRequest("Avatar seçimleri okunamadı. Sayfayı yenileyip tekrar deneyin.");
    }

    await saveTeamAvatar(
      { ...user },
      { displayName: text(formData, "displayName"), teamRole: text(formData, "teamRole"), config },
      await requestMetadata(),
    );

    revalidatePath("/team/avatar");
    revalidatePath("/admin/team-avatars");
    return { success: "Avatarınız kaydedildi ve yönetime iletildi. Teşekkürler!" };
  });
}

export async function deleteOwnTeamAvatarAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await deleteOwnTeamAvatar({ ...user }, await requestMetadata());

    revalidatePath("/team/avatar");
    revalidatePath("/admin/team-avatars");
    return { success: "Avatarınız silindi." };
  });
}
