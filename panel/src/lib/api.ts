/**
 * Helpers for route handlers.
 *
 * Public responses are cacheable and carry an ETag, so a front end or a CDN can
 * revalidate cheaply (§10). Errors are rendered through the same `AppError`
 * translation the rest of the application uses.
 */
import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";

/** Weak ETag over the serialised body. */
function etagFor(body: string): string {
  return `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`;
}

export function publicJson(
  data: unknown,
  request: Request,
  { maxAge = 60, staleWhileRevalidate = 600 }: { maxAge?: number; staleWhileRevalidate?: number } = {},
): NextResponse {
  const body = JSON.stringify(data);
  const etag = etagFor(body);

  // 304 saves the client from downloading a payload it already holds
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        etag,
        "cache-control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
      },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      etag,
      "cache-control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    },
  });
}

export function errorJson(error: unknown): NextResponse {
  const { status, body } = toErrorResponse(error);
  return NextResponse.json(body, {
    status,
    // An error must never be cached in place of real content
    headers: { "cache-control": "no-store" },
  });
}
