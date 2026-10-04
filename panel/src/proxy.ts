/**
 * Issues the CSRF cookie.
 *
 * This is the Next 16 `proxy` convention, the renamed middleware.
 *
 * A server component cannot write cookies during render, so the double submit
 * token is minted here, on the way in, and read back by the form. The actual
 * verification happens in `assertCsrf` inside every server action.
 */
import { NextResponse, type NextRequest } from "next/server";

const CSRF_COOKIE = "ps_csrf";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(CSRF_COOKIE)) {
    // Not a secret on its own: it only has to be unguessable and same-origin
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    {
      // API routes render no forms; the ones that check CSRF are called from
      // pages, which have already been through here and carry the cookie
      source: "/((?!_next/static|_next/image|favicon.ico|api/).*)",
      // Once the cookie exists there is nothing left to do, so the proxy is not
      // invoked at all; it ran on every request and was billed for each.
      // A literal, not CSRF_COOKIE: Next reads this config statically at build
      missing: [{ type: "cookie", key: "ps_csrf" }],
    },
  ],
};
