/**
 * GET /api/admin/team-memberships.json — the team's duties and their dates,
 * for the owner's agenda app (D-302). Admin only, behind the same 2FA session
 * as every other admin download.
 */
import { NextResponse } from "next/server";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { exportTeamMemberships } from "@/services/team-memberships";
import { errorJson } from "@/lib/api";

export async function GET() {
  try {
    const { user } = await requireRole("admin");
    const { ip } = await requestMetadata();
    const body = await exportTeamMemberships({ ...user }, { ip });

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="postscript-ekip-${body.generatedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorJson(error);
  }
}
