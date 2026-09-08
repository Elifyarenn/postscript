"use server";

/**
 * Server actions for the public authentication screens.
 *
 * Each one verifies CSRF first, then calls a service. No authorisation decision
 * is made here beyond that: the services own the rules.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { badRequest } from "@/lib/errors";
import {
  registerWriterCandidate,
  requestPasswordReset,
  resetPassword,
  verifyCredentials,
  verifyEmail,
  confirmEmailChange,
} from "@/services/auth";
import {
  createSession,
  destroyCurrentSession,
  getAuthContext,
  requestMetadata,
  revokeAllSessions,
} from "@/lib/auth/session";
import {
  checkLoginCodeLimit,
  consumeLoginChallenge,
  createLoginChallenge,
  verifyLoginCode,
  TWO_FACTOR_COOKIE,
} from "@/services/two-factor";
import { assertCsrfFromForm } from "@/lib/csrf";
import { runAction, text, checkbox, type ActionState } from "@/lib/action";
import { clearAttempts } from "@/lib/rate-limit";
import { isProduction } from "@/lib/env";
import type { Role } from "@/db/schema";

/** Where a signed-in user belongs, by role. */
function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "editor") return "/editor";
  if (role === "writer") return "/writer";
  return "/magazine";
}

/**
 * The public writer registration (/yazar-basvuru). The only entry point for
 * new accounts while the site is closed: the form stays open and the address
 * proof (D-049) is what turns the account into a writer later.
 */
export async function registerWriterAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const { user } = await registerWriterCandidate(
      {
        email: text(formData, "email"),
        password: text(formData, "password"),
        displayName: text(formData, "displayName"),
        birthDate: text(formData, "birthDate"),
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

    // Second factor half: the password was right, but the session is only
    // created once the authenticator code follows (D-048)
    if (outcome.user.totpEnabledAt !== null) {
      const rawToken = await createLoginChallenge(outcome.user.id);
      const cookieStore = await cookies();
      cookieStore.set(TWO_FACTOR_COOKIE, rawToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction(),
        path: "/",
        maxAge: 5 * 60,
      });
      destination = "/login/2fa";
      return;
    }

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

/**
 * The second half of a two-factor login: the code in the authenticator app.
 * The challenge cookie proves the password half already succeeded in this
 * browser, so the code is only ever checked against that ticket's user.
 */
export async function loginTwoFactorAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const cookieStore = await cookies();
    const rawToken = cookieStore.get(TWO_FACTOR_COOKIE)?.value;
    if (!rawToken) {
      throw badRequest("Doğrulama adımının süresi doldu, tekrar giriş yapın.");
    }

    const userId = await consumeLoginChallenge(rawToken);
    if (!userId) {
      throw badRequest("Doğrulama adımının süresi doldu, tekrar giriş yapın.");
    }

    await checkLoginCodeLimit(userId);

    const code = text(formData, "code");
    if (!(await verifyLoginCode(userId, code))) {
      throw badRequest("Kod doğrulanamadı.", { code: ["Kod doğrulanamadı."] });
    }

    // A success must not keep counting against the second-factor bucket
    await clearAttempts("login_2fa", userId);

    await createSession({ userId, ip: meta.ip, userAgent: meta.userAgent });
    cookieStore.delete(TWO_FACTOR_COOKIE);

    const context = await getAuthContext();
    destination = context ? homeFor(context.user.role) : "/login";
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

export async function confirmEmailChangeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let destination: string | null = null;

  const result = await runAction(async () => {
    await assertCsrfFromForm(formData);
    const meta = await requestMetadata();

    const user = await confirmEmailChange(text(formData, "token"), meta);
    // The address changed, so every other session must go (a reset does the same)
    await revokeAllSessions(user.id);

    // Whoever is still signed in on this browser goes straight home
    const context = await getAuthContext();
    destination = context?.user.id === user.id ? `${homeFor(user.role)}?emailChanged=1` : "/login";
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
