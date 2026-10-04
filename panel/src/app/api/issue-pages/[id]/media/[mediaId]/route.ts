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
 * The answer is never put in a shared cache: two people may get different
 * answers for the same address, and a shared cache must not decide which one.
 * A picture of a published issue is the same for everyone and its bytes never
 * change under a media id (a replaced picture is a new media row), so the reader's own
 * browser may keep it for an hour instead of asking again on every page turn.
 * Anything not public stays no-store.
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
    // A published issue is public (D-257); the service still closes every other
    // one, and only then asks who is reading
    const { id, mediaId } = await params;
    const loadActor = async () => {
      const context = await readerSession();
      return context ? { ...context.user } : null;
    };

    const file = await readPageMedia(loadActor, id, mediaId);

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "content-type": file.mime,
        "content-length": String(file.body.length),
        "cache-control": file.isPublic ? "private, max-age=3600" : "private, no-store",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
