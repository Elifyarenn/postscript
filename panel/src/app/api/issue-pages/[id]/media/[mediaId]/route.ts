/**
 * GET /api/issue-pages/:id/media/:mediaId — a picture that belongs to a page.
 *
 * Page pictures do not go through the media library route (D-240). A designed
 * page is the issue: if the issue is closed, so is every pixel of it, and an
 * issue marked "admin only" is closed even to an editor who could otherwise
 * read the whole library. The service asks both questions — may this actor
 * open this issue, and does this page really use this picture — so knowing a
 * media id gets nobody anywhere.
 *
 * The answer is private and never cached: two people may get different answers
 * for the same address, and a shared cache must not decide which one.
 */
import { NextResponse } from "next/server";
import { readerSession } from "@/lib/auth/guard";
import { errorJson } from "@/lib/api";
import { readPageMedia } from "@/services/issue-pages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    // A published issue is public (D-257); the service still closes every other one
    const context = await readerSession();
    const { id, mediaId } = await params;

    const file = await readPageMedia(context ? { ...context.user } : null, id, mediaId);

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "content-type": file.mime,
        "content-length": String(file.body.length),
        "cache-control": "private, no-store",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
