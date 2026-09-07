"use server";

/**
 * Community actions: commenting on an article.
 * The chat room posts through its own API endpoint instead (live polling),
 * so there is no page reload for chat messages.
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