/**
 * DELETE /api/community/messages/:id — removes a chat message (soft delete).
 * Admin only, so the room can offer inline moderation.
 */
import { NextResponse } from "next/server";
import { removeChatMessage } from "@/services/community";
import { errorJson } from "@/lib/api";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/csrf";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertCsrf(request.headers.get("x-csrf-token"));
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();
    const { id } = await params;

    await removeChatMessage({ ...user }, id, meta);

    return NextResponse.json(
      { ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}