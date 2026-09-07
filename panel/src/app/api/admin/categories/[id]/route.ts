/**
 * PUT /api/admin/categories/:id — updates a category (name, quota, active).
 *
 * DELETE /api/admin/categories/:id — soft deletes a category. Admin only.
 */
import { NextResponse } from "next/server";
import { deleteCategory, updateCategory } from "@/services/leads";
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
    const category = await updateCategory({ ...user }, id, body ?? {}, meta);

    return NextResponse.json(
      { category },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertCsrf(request.headers.get("x-csrf-token"));
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();
    const { id } = await params;

    await deleteCategory({ ...user }, id, meta);

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}