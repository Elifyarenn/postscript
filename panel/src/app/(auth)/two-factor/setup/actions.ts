"use server";

/**
 * TOTP enrolment (DECISIONS.md D-006).
 *
 * The secret is staged when the page is opened and only becomes active once the
 * user proves they can generate a code from it. Recovery codes are handed out
 * at that same moment, and never again.
 */
import { getAuthContext, markTwoFactorVerified } from "@/lib/auth/session";
import {
  confirmTotp,
  consumeRecoveryCode,
  issueRecoveryCodes,
  readTotpSecret,
  verifyTotpCode,
} from "@/lib/auth/totp";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, type ActionState } from "@/lib/action";
import { unauthorized } from "@/lib/errors";

export async function confirmTotpAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);

    const context = await getAuthContext();
    if (!context) throw unauthorized();

    const secret = await readTotpSecret(context.user.id);
    if (!secret) {
      return { error: "Kurulum başlatılmamış. Sayfayı yenileyin." };
    }

    if (!verifyTotpCode(secret, text(formData, "code"))) {
      return { error: "Kod doğrulanamadı. Uygulamadaki güncel kodu girin." };
    }

    await confirmTotp(context.user.id);
    const codes = await issueRecoveryCodes(context.user.id);
    await markTwoFactorVerified(context.sessionId);

    return {
      success:
        "İki adımlı doğrulama açıldı. Aşağıdaki kurtarma kodlarını güvenli bir yere kaydedin; " +
        "bu kodlar bir daha gösterilmeyecek.",
      codes,
    };
  });
}

/** Lets someone who lost their device get in with a recovery code. */
export async function useRecoveryCodeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);

    const context = await getAuthContext();
    if (!context) throw unauthorized();

    if (!(await consumeRecoveryCode(context.user.id, text(formData, "code")))) {
      return { error: "Kurtarma kodu geçersiz veya daha önce kullanılmış." };
    }

    await markTwoFactorVerified(context.sessionId);
    return { success: "Kurtarma kodu kabul edildi." };
  });
}
