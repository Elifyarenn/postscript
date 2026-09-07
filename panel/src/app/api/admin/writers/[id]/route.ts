/**
 * PUT /api/admin/writers/:id — updates a writer-lead (fields, status,
 * categories). Admin only; approving respects the category quotas.
 */
import { NextResponse } from "next/server";
import { updateLead } from "@/services/leads";
import { errorJson } from "@/lib/api";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/csrf";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertCsrf(request.headers.get("x-csrf-token"));
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const updated = await updateLead({ ...user }, id, body ?? {}, meta);

    return NextResponse.json(
      { lead: updated },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}