"use server";

/**
 * Çizer panel actions (D-362): handing a drawing in and taking one back. The
 * session is enough here; the service checks the çizer mark and who may remove.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { assertCsrfFromForm } from "@/lib/csrf";
import { optionalText, runAction, text, type ActionState } from "@/lib/action";
import { removeIllustration, uploadIllustration } from "@/services/illustrations";

export async function uploadIllustrationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Dosya seçilmedi.");

    await uploadIllustration(
      { ...user },
      {
        buffer: Buffer.from(await file.arrayBuffer()),
        declaredMime: file.type,
        fileName: file.name,
        fields: {
          title: text(formData, "title"),
          note: optionalText(formData, "note"),
          issueId: optionalText(formData, "issueId"),
        },
      },
      await requestMetadata(),
    );

    revalidatePath("/cizer/cizimler");
    revalidatePath("/editor/cizimler");
    return { success: "Çiziminiz yüklendi. Yönetici ve ana editör panelinde görünüyor." };
  });
}

export async function removeIllustrationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();

    await removeIllustration({ ...user }, text(formData, "illustrationId"), await requestMetadata());

    revalidatePath("/cizer/cizimler");
    revalidatePath("/editor/cizimler");
    return { success: "Çizim kaldırıldı." };
  });
}
