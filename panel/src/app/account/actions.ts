"use server";

/**
 * Profile, password, sessions and account deletion.
 *
 * Shared by the plain user area and by the writer panel's security page, so
 * there is one implementation of each rule rather than two.
 */
import { revalidatePath } from "next/cache";
import { changePassword, resendVerificationEmail } from "@/services/auth";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  updateProfile,
} from "@/services/users";
import {
  requestMetadata,
  requireAuth,
  revokeAllSessions,
  revokeSession,
} from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { listAnnouncementsFor } from "@/services/announcements";
import { runAction, optionalText, text, type ActionState } from "@/lib/action";
import { badRequest } from "@/lib/errors";

export async function updateProfileAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const socialLinks: Record<string, string> = {};
    for (const key of ["x", "instagram", "tiktok", "substack"]) {
      const value = optionalText(formData, `social_${key}`);
      if (value) socialLinks[key] = value;
    }

    await updateProfile(
      { ...user },
      {
        displayName: text(formData, "displayName"),
        penName: optionalText(formData, "penName"),
        bio: optionalText(formData, "bio"),
        birthDate: optionalText(formData, "birthDate"),
        ...(Object.keys(socialLinks).length > 0 ? { socialLinks } : {}),
      },
      meta,
    );

    revalidatePath("/account");
    revalidatePath("/writer/profile");
    return { success: "Profiliniz güncellendi." };
  });
}

export async function changePasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const next = text(formData, "password");
    if (next !== text(formData, "passwordConfirm")) {
      throw badRequest("Şifreler eşleşmiyor.", { passwordConfirm: ["Şifreler eşleşmiyor."] });
    }

    await changePassword(user.id, text(formData, "currentPassword"), next, meta);
    return { success: "Şifreniz güncellendi." };
  });
}

export async function resendVerificationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    await resendVerificationEmail(user.id);
    return { success: "Doğrulama bağlantısı tekrar gönderildi." };
  });
}

export async function revokeSessionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    await revokeSession(user.id, text(formData, "sessionId"));
    revalidatePath("/account");
    revalidatePath("/writer/profile");
    return { success: "Oturum kapatıldı." };
  });
}

export async function revokeOtherSessionsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const context = await requireAuth();

    // Everything except the session making the request
    await revokeAllSessions(context.user.id, context.sessionId);
    revalidatePath("/account");
    revalidatePath("/writer/profile");
    return { success: "Diğer tüm oturumlar kapatıldı." };
  });
}

export async function requestDeletionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    await requestAccountDeletion({ ...user }, meta);
    revalidatePath("/account");
    return {
      success:
        "Silme talebiniz alındı. Hesabınız 30 gün sonra silinecek; bu süre içinde iptal edebilirsiniz.",
    };
  });
}

export async function cancelDeletionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    await cancelAccountDeletion({ ...user });
    revalidatePath("/account");
    return { success: "Silme talebiniz iptal edildi." };
  });
}

export async function markAnnouncementsReadAction(): Promise<void> {
  const { user } = await requireAuth();
  // Reading the list is what records a read; kept here so the writer dashboard
  // can trigger it without duplicating the query
  await listAnnouncementsFor({ ...user });
}
