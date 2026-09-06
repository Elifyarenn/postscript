/**
 * CSRF protection for every mutation (specification §11).
 *
 * Two independent checks:
 *  1. the request Origin (or Referer) must match APP_URL
 *  2. a double submit token: a cookie value that the form must echo back
 *
 * Server actions in Next.js already verify the origin, but this module makes
 * the guarantee explicit and applies equally to route handlers.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { randomToken, safeEquals } from "@/lib/crypto";
import { env, isProduction } from "@/lib/env";
import { forbidden } from "@/lib/errors";

export const CSRF_COOKIE = "ps_csrf";
export const CSRF_FIELD = "csrfToken";

/** Reads the CSRF token, creating one when the visitor does not have it yet. */
export async function ensureCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;
  if (existing) return existing;

  const token = randomToken(24);
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false, // the form must be able to read it; it is not a secret on its own
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
  });
  return token;
}

/** Same as `ensureCsrfToken` but safe to call where cookies cannot be written. */
export async function readCsrfToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE)?.value ?? null;
}

function originMatches(candidate: string | null, appUrl: string): boolean {
  if (!candidate) return false;
  try {
    return new URL(candidate).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

/** Throws 403 when the request does not come from our own origin. */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const appUrl = env().APP_URL;

  const origin = headerList.get("origin");
  const referer = headerList.get("referer");

  // A same origin browser request always sends at least one of the two on mutations
  if (originMatches(origin, appUrl)) return;
  if (origin === null && originMatches(referer, appUrl)) return;

  throw forbidden("İstek kaynağı doğrulanamadı.");
}

/** Full check for a mutation: origin plus double submit token. */
export async function assertCsrf(submittedToken: string | null | undefined): Promise<void> {
  await assertSameOrigin();

  const expected = await readCsrfToken();
  if (!expected || !submittedToken || !safeEquals(expected, submittedToken)) {
    throw forbidden("Form doğrulaması başarısız oldu, sayfayı yenileyip tekrar deneyin.");
  }
}

/** Convenience for server actions that receive a FormData. */
export async function assertCsrfFromForm(formData: FormData): Promise<void> {
  const value = formData.get(CSRF_FIELD);
  await assertCsrf(typeof value === "string" ? value : null);
}
