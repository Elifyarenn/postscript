"use server";

/**
 * The team form's action (D-226): CSRF check → session → service → revalidate.
 * The service repeats every rule, including that an avatar must already exist.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { saveTeamForm } from "@/services/team-avatars";

export async function saveTeamFormAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    await saveTeamForm(
      { ...user },
      {
        motto: text(formData, "motto"),
        teamByline: text(formData, "teamByline"),
        zodiac: text(formData, "zodiac"),
      },
      await requestMetadata(),
    );

    revalidatePath("/team/form");
    revalidatePath("/admin/team-avatars");
    return { success: "Yanıtlarınız kaydedildi. Teşekkürler!" };
  });
}
