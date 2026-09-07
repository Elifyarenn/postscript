"use server";

/**
 * Community actions: commenting on an article and posting to the chat.
 * The services mask banned words before anything is stored.
 */
import { revalidatePath } from "next/cache";
import { addChatMessage, addCommunityComment } from "@/services/community";
import { requestMetadata, requireAuth } from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { optionalText, runAction, text, type ActionState } from "@/lib/action";

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

export async function addChatMessageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const { user } = await requireAuth();
    const meta = await requestMetadata();

    await addChatMessage(
      { ...user },
      {
        body: text(formData, "body"),
        quotedMessageId: optionalText(formData, "quotedMessageId"),
      },
      meta,
    );

    revalidatePath("/community");
    return { success: "Mesajınız gönderildi." };
  });
}