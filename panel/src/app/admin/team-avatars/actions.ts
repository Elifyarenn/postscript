"use server";

/** Admin actions on team avatars (D-194); the service re-checks the admin role. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { deleteTeamAvatarAsAdmin } from "@/services/team-avatars";

export async function deleteTeamAvatarAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    await deleteTeamAvatarAsAdmin({ ...user }, text(formData, "avatarId"), await requestMetadata());

    revalidatePath("/admin/team-avatars");
    redirect("/admin/team-avatars?deleted=1");
  });
}
