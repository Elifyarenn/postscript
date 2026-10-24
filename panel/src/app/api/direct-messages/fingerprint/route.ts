/**
 * GET /api/direct-messages/fingerprint?with=<username> — one string that
 * changes when an open conversation screen would show something new, for its
 * poll (D-364), as the chat room polls `/api/community/messages`. Session
 * required; reads only.
 */
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { requireAuth } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { conversationFingerprint } from "@/services/direct-messages";

export async function GET(request: Request) {
  try {
    // A banned or unverified account gets nothing here either (D-072)
    const context = await requireAuth();
    const username = new URL(request.url).searchParams.get("with");
    if (!username) throw badRequest("Üye belirtilmedi.");

    const fingerprint = await conversationFingerprint({ ...context.user }, username);
    return NextResponse.json({ fingerprint }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}
