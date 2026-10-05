/**
 * GET /api/contributor-documents/:id/pdf — a prepared contract or licence
 * form, as a PDF to print and sign (D-276).
 *
 * Only its owner and an admin get it; anyone else gets "not found", as for a
 * missing id. The PDF is drawn from the stored text on each request, so there
 * is no file that could be reached around this route.
 */
import { NextResponse } from "next/server";
import { requireAuthForFiles } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { contributorDocumentPdf } from "@/services/contributor-documents";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthForFiles();
    const { id } = await params;
    const file = await contributorDocumentPdf({ ...context.user }, id);

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
