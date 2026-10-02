"use server";

/**
 * Writing an issue's quizzes (D-240): CSRF check → session → service.
 *
 * The whole quiz travels as one JSON field, because that is what it is: a
 * shape with questions inside options inside it. Saving it in one write means
 * the panel can never leave half a quiz behind, and the service re-checks
 * every rule including who may do this at all.
 */
import { revalidatePath } from "next/cache";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { badRequest } from "@/lib/errors";
import { createQuiz, removeQuiz, setQuizAuthor, updateQuiz } from "@/services/issue-quizzes";

function quizInput(formData: FormData): unknown {
  const raw = formData.get("quiz");
  if (typeof raw !== "string" || raw.trim() === "") throw badRequest("Test bilgisi boş geldi.");
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Test okunamadı. Sayfayı yenileyip tekrar deneyin.");
  }
}

function refresh(issueId: string): void {
  revalidatePath(`/editor/issues/${issueId}/testler`);
  revalidatePath(`/editor/issues/${issueId}/sayfalar`);
}

export async function createQuizAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const issueId = text(formData, "issueId");

    await createQuiz({ ...user }, issueId, quizInput(formData), await requestMetadata());
    refresh(issueId);
    return { success: "Test oluşturuldu." };
  });
}

export async function updateQuizAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await updateQuiz({ ...user }, text(formData, "quizId"), quizInput(formData), await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Test kaydedildi." };
  });
}

/** Names who wrote the quiz, so its licence form can be prepared on their account (D-300). */
export async function setQuizAuthorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");
    const email = formData.get("authorEmail");

    await setQuizAuthor({ ...user }, text(formData, "quizId"), typeof email === "string" ? email : "", await requestMetadata());
    refresh(text(formData, "issueId"));
    revalidatePath("/admin/agreements");
    return { success: "Eser sahibi kaydedildi. Ruhsat formu için Sözleşmeler sayfasında “Belgeleri hazırla”." };
  });
}

export async function removeQuizAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireRole("admin");

    await removeQuiz({ ...user }, text(formData, "quizId"), await requestMetadata());
    refresh(text(formData, "issueId"));
    return { success: "Test kaldırıldı." };
  });
}
