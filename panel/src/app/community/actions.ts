"use server";

/**
 * Community actions: commenting on an article. The chat room was removed from
 * the panel (D-056); its API endpoints stay, but new posts are refused.
 */
import { revalidatePath } from "next/cache";
import { addCommunityComment } from "@/services/community";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";

export async function addCommentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    const articleId = text(formData, "articleId");
    await addCommunityComment(
      { ...user },
      { articleId, body: text(formData, "body") },
      meta,
    );

    revalidatePath(`/magazine/articles/${articleId}`);
    return { success: "Yorumunuz yayınlandı." };
  });
}