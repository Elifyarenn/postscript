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
  // Everything except static assets and the public API, which has no forms
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/public).*)"],
};
