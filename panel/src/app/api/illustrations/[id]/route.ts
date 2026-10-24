/**
 * GET /api/illustrations/:id — a drawing a çizer handed in (D-362), for the
 * çizer and the reviewers only; the service decides who.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthForFiles } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { readIllustrationFile } from "@/services/illustrations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // A banned or unverified account pulls no files either (D-072)
    const context = await requireAuthForFiles();
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) throw notFound("Çizim bulunamadı.");

    const file = await readIllustrationFile(context.user, id);
    const download = new URL(request.url).searchParams.has("indir");
    const extension = file.mime === "image/png" ? "png" : file.mime === "image/webp" ? "webp" : "jpg";

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "content-type": file.mime,
        "content-length": String(file.body.length),
        // Unpublished work: never CDN material
        "cache-control": "private, no-store",
        "content-disposition": download
          ? `attachment; filename="cizim-${id.slice(0, 8)}.${extension}"`
          : "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
