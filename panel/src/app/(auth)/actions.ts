"use server";

/**
 * Server actions for the public authentication screens.
 *
 * Each one verifies CSRF first, then calls a service. No authorisation decision
 * is made here beyond that: the services own the rules.
 */
import { redirect } from "next/navigation";
import {
  register,
  requestPasswordReset,
  resetPassword,
  verifyCredentials,
  verifyEmail,
} from "@/services/auth";
import {
  createSession,
  destroyCurrentSession,
  getAuthContext,
  markTwoFactorVerified,
  requestMetadata,
  revokeAllSessions,
} from "@/lib/auth/session";
import { consumeRecoveryCode, readTotpSecret, verifyTotpCode } from "@/lib/auth/totp";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, checkbox, type ActionState } from "@/lib/action";
import type { Role } from "@/db/schema";

/** Where a signed-in user belongs, by role. */
function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "editor") return "/editor";
  if (role === "writer") return "/writer";
  return "/account";
}

export async function registerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const { user } = await register(
      {
        email: text(formData, "email"),
        password: text(formData, "password"),
        displayName: text(formData, "displayName"),
        kvkkConsent: checkbox(formData, "kvkkConsent") as true,
      },
      meta,
    );

    // Signed in straight away, but nothing except the profile works until the
    // address is verified (§5.1)
    await createSession({
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      totpVerified: true,
    });
    destination = "/account?registered=1";
  });

  if (destination) redirect(destination);
  return result;
}

export async function loginAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const outcome = await verifyCredentials(
      { email: text(formData, "email"), password: text(formData, "password") },
      meta,
    );

    // The session exists but is not yet trusted for elevated roles
    const twoFactorPending = outcome.twoFactorRequired || outcome.twoFactorSetupRequired;

    await createSession({
      userId: outcome.user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      totpVerified: !twoFactorPending,
    });

    destination = outcome.twoFactorSetupRequired
      ? "/two-factor/setup"
      : outcome.twoFactorRequired
        ? "/two-factor"
        : homeFor(outcome.user.role);
  });

  if (destination) redirect(destination);
  return result;
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function verifyEmailAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();
    await verifyEmail(text(formData, "token"), meta);
    return { success: "E-posta adresiniz doğrulandı." };
  });
}

export async function requestPasswordResetAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();
    await requestPasswordReset({ email: text(formData, "email") }, meta);
    // Deliberately the same answer whether or not the address exists
    return {
      success: "Adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi.",
    };
  });
}

export async function resetPasswordAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let done = false;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const userId = await resetPassword(
      { token: text(formData, "token"), password: text(formData, "password") },
      meta,
    );
    // §5.3: a reset invalidates every session the account had
    await revokeAllSessions(userId);
    done = true;
  });

  if (done) redirect("/login?reset=1");
  return result;
}

/* ------------------------------------------------------------------ */
/* Two factor                                                          */
/* ------------------------------------------------------------------ */

export async function verifyTotpAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);

    const context = await getAuthContext();
    if (!context) redirect("/login");

    const code = text(formData, "code");
    const secret = await readTotpSecret(context.user.id);

    const accepted = secret
      ? verifyTotpCode(secret, code) || (await consumeRecoveryCode(context.user.id, code))
      : false;

    if (!accepted) {
      return { error: "Kod doğrulanamadı. Uygulamadaki güncel kodu girin." };
    }

    await markTwoFactorVerified(context.sessionId);
    destination = homeFor(context.user.role);
  });

  if (destination) redirect(destination);
  return result;
}
