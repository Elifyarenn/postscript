"use server";

/**
 * Writer panel actions: acknowledging announcements, accepting the framework
 * agreement, and signing or declining a rights grant.
 */
import { revalidatePath } from "next/cache";
import { acknowledge, markRead } from "@/services/announcements";
import { acceptAgreement } from "@/services/agreements";
import { declineRightsGrantAndReturnForRevision } from "@/services/articles";
import { signRightsGrant } from "@/services/rights";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { checkbox, runAction, text, type ActionState } from "@/lib/action";

export async function acknowledgeAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await acknowledge({ ...user }, text(formData, "announcementId"), meta);
    revalidatePath("/writer", "layout");
    return { success: "Duyuru onaylandı." };
  });
}

export async function markAnnouncementReadAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");

    await markRead({ ...user }, text(formData, "announcementId"));
    revalidatePath("/writer/announcements");
    return { success: "Okundu olarak işaretlendi." };
  });
}

export async function acceptAgreementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await acceptAgreement(
      { ...user },
      {
        agreementVersionId: text(formData, "agreementVersionId"),
        bodyHash: text(formData, "bodyHash"),
        acknowledged: checkbox(formData, "acknowledged") as true,
      },
      meta,
    );

    // The whole writer panel unlocks on acceptance, so refresh the shell too
    revalidatePath("/writer", "layout");
    return { success: "Sözleşmeyi onayladınız. Yazar sayfalarınız açıldı." };
  });
}

export async function signGrantAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await signRightsGrant(
      { ...user },
      {
        grantId: text(formData, "grantId"),
        formTextHash: text(formData, "formTextHash"),
        acknowledged: checkbox(formData, "acknowledged") as true,
      },
      meta,
    );

    revalidatePath("/writer/rights");
    return { success: "Formu imzaladınız. Bir kopyası e-posta ile gönderildi." };
  });
}

export async function declineGrantAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("writer");
    const meta = await requestMetadata();

    await declineRightsGrantAndReturnForRevision(
      { ...user },
      { grantId: text(formData, "grantId"), reason: text(formData, "reason") },
      meta,
    );

    revalidatePath("/writer/rights");
    return { success: "Formu reddettiniz, editöre bildirildi." };
  });
}
