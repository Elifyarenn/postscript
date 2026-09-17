/**
 * GET /api/admin/team-avatars/zip[?id=…&id=…] — team avatars as one ZIP
 * (D-194): the selected ones, or all of them without `id`. The archive is
 * streamed file by file, so a large team never has to fit in one response.
 */
import { requireRole } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { zipStream } from "@/lib/zip";
import { teamAvatarZipEntries } from "@/services/team-avatars";

export async function GET(request: Request) {
  try {
    const { user } = await requireRole("admin");
    const ids = new URL(request.url).searchParams.getAll("id");
    const { entries } = await teamAvatarZipEntries({ ...user }, ids.length > 0 ? ids : null);

    const iterator = zipStream(entries);
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          console.error("Team avatar ZIP failed:", error instanceof Error ? error.message : error);
          controller.error(error);
        }
      },
      async cancel() {
        await iterator.return(undefined);
      },
    });

    const date = new Date().toISOString().slice(0, 10);
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="postscript-ekip-avatarlari-${date}.zip"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
