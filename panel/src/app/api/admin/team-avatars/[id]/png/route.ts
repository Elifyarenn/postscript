/**
 * GET /api/admin/team-avatars/:id/png — one team avatar as a transparent PNG
 * (D-194). An attachment named after the member by default; `?inline=1`
 * shows it in the page instead, for the large preview.
 */
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { errorJson } from "@/lib/api";
import { getTeamAvatarPng } from "@/services/team-avatars";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole("admin");
    const { id } = await params;
    const { body, fileName } = await getTeamAvatarPng({ ...user }, id);
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": String(body.length),
        // The name is slugified to ASCII, so no RFC 5987 variant is needed
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
