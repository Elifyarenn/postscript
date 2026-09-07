/**
 * GET  /api/community/messages?after=<iso> — messages created after a
 *      timestamp, for the chat room's poll feed. Session required.
 * POST /api/community/messages — creates a message and returns it, so the
 *      room can append it without a page reload. Session + CSRF required.
 */
import { NextResponse } from "next/server";
import { addChatMessage, listChatMessagesAfter } from "@/services/community";
import { errorJson } from "@/lib/api";
import { getAuthContext, requestMetadata } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/csrf";
import { unauthorized } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const context = await getAuthContext();
    if (!context) throw unauthorized();

    const { searchParams } = new URL(request.url);
    const afterParam = searchParams.get("after");
    const after = afterParam ? new Date(afterParam) : null;
    if (after && Number.isNaN(after.getTime())) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Geçersiz zaman damgası." } },
        { status: 400 },
      );
    }

    const messages = after
      ? await listChatMessagesAfter(after)
      : await listChatMessagesAfter(new Date(0));

    return NextResponse.json(
      { messages },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertCsrf(request.headers.get("x-csrf-token"));
    const context = await getAuthContext();
    if (!context) throw unauthorized();
    const meta = await requestMetadata();

    const body = await request.json().catch(() => null);
    const message = await addChatMessage({ ...context.user }, body ?? {}, meta);

    return NextResponse.json(
      { message },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}