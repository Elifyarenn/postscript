/**
 * GET /api/admin/signed-contracts/zip — the verified, member-signed PDFs in
 * one ZIP for the magazine to sign (D-290). `?which=all` includes the ones
 * already signed back; the default is only those still waiting.
 *
 * Admin only (the service checks); the archive is written as it is sent, one
 * file at a time.
 */
import { requireAuth } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { zipStream } from "@/lib/zip";
import { countersignZipEntries } from "@/services/signed-contracts";

export async function GET(request: Request) {
  try {
    const context = await requireAuth();
    const which = new URL(request.url).searchParams.get("which") === "all" ? "all" : "waiting";
    const { entries } = await countersignZipEntries({ ...context.user }, which);

    const chunks = zipStream(entries);
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await chunks.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="imzalanacak-sozlesmeler-${which === "all" ? "tumu-" : ""}${day}.zip"`,
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
