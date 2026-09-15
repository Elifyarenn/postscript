"use server";

/**
 * The contact form's action (D-145): CSRF check, then the service, which does
 * the rate limit, the bot check and the mail. Nothing is stored.
 */
import { requestMetadata } from "@/lib/auth/session";
import { BOT_TOKEN_FIELD } from "@/lib/bot-token";
import { assertCsrfFromForm } from "@/lib/csrf";
import { optionalText, runAction, text, type ActionState } from "@/lib/action";
import { sendContactMessage } from "@/services/contact";

export async function sendContactMessageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    await sendContactMessage(
      {
        name: text(formData, "name"),
        email: text(formData, "email"),
        subject: optionalText(formData, "subject"),
        topic: optionalText(formData, "topic"),
        message: text(formData, "message"),
      },
      meta,
      optionalText(formData, BOT_TOKEN_FIELD),
    );

    return { success: "Mesajınız bize ulaştı. En kısa sürede yanıtlayacağız." };
  });
}
