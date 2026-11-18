/**
 * GET /api/licence-acceptances/:id/pdf — a licence form accepted in the panel
 * at submission (D-387), with its acceptance record.
 *
 * Only its owner and an agreements admin get it; anyone else gets "not
 * found", as for a missing id. Drawn from the stored row on each request.
 */
import { NextResponse } from "next/server";
import { requireAuthForFiles } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { licenceAcceptancePdf } from "@/services/licence-acceptances";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthForFiles();
    const { id } = await params;
    const file = await licenceAcceptancePdf({ ...context.user }, id);

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": String(file.body.length),
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${file.fileName}"`,
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
