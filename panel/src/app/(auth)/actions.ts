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
  requestMetadata,
  revokeAllSessions,
} from "@/lib/auth/session";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, checkbox, type ActionState } from "@/lib/action";
import type { Role } from "@/db/schema";

/** Where a signed-in user belongs, by role. */
function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "editor") return "/editor";
  if (role === "writer") return "/writer";
  return "/magazine";
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

    // A session is opened so the account can ask for another link, but that is
    // all it can do until the address is verified (D-034)
    await createSession({ userId: user.id, ip: meta.ip, userAgent: meta.userAgent });
    destination = "/verify-email/pending";
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

    await createSession({
      userId: outcome.user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    destination =
      outcome.user.emailVerifiedAt === null
        ? "/verify-email/pending"
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
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const user = await verifyEmail(text(formData, "token"), meta);

    // Someone who followed the link in the same browser goes straight in;
    // anyone else is sent to sign in with a confirmed address
    const context = await getAuthContext();
    // ?verified=1 is what prints the welcome banner on the far side
    destination =
      context?.user.id === user.id ? `${homeFor(user.role)}?verified=1` : "/login?verified=1";
  });

  if (destination) redirect(destination);
  return result;
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
