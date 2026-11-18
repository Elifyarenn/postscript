"use server";

/**
 * Çizer panel actions (D-362): handing a drawing in and taking one back. The
 * session is enough here; the service checks the çizer mark and who may remove.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { assertCsrf, assertCsrfFromForm } from "@/lib/csrf";
import { licencePreviewFailure, type LicencePreviewResult } from "@/lib/licence-preview";
import { previewDrawingLicence } from "@/services/licence-acceptances";
import { optionalText, runAction, text, type ActionState } from "@/lib/action";
import { assertIllustratorAccount, removeIllustration, uploadIllustration } from "@/services/illustrations";

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
        illustrationId: optionalText(formData, "illustrationId"),
        licence: licenceFromForm(formData),
        fields: {
          title: text(formData, "title"),
          note: optionalText(formData, "note"),
          issueId: text(formData, "issueId"),
        },
      },
      await requestMetadata(),
    );

    revalidatePath("/cizer/cizimler");
    revalidatePath("/admin/cizimler");
    return {
      success:
        "Çiziminiz yüklendi ve yöneticiye iletildi. Onayladığınız ruhsat formunun PDF kopyası e-postanıza ve Belgelerim'e gelir.",
    };
  });
}

/** The accepted form's fields the licence box writes into the form (D-387). */
function licenceFromForm(formData: FormData): { formId: string; textHash: string } | undefined {
  const formId = optionalText(formData, "licenceFormId");
  const textHash = optionalText(formData, "licenceTextHash");
  return formId && textHash ? { formId, textHash } : undefined;
}

/**
 * The licence form for the drawing chosen on screen (D-387): the browser
 * sends the file's hash, type and size, not the file, and the upload checks
 * them against the file that arrives.
 */
export async function previewDrawingLicenceAction(input: {
  csrfToken: string;
  sha256: string;
  mime: string;
  size: number;
}): Promise<LicencePreviewResult> {
  try {
    await assertCsrf(input.csrfToken);
    const { user } = await requireAuth();
    await assertIllustratorAccount({ ...user });
    const preview = await previewDrawingLicence({ ...user }, { sha256: input.sha256, mime: input.mime, size: input.size });
    return { ok: true, ...preview };
  } catch (error) {
    return licencePreviewFailure(error);
  }
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
    revalidatePath("/admin/cizimler");
    return { success: "Çizim kaldırıldı." };
  });
}
