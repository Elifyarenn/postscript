/**
 * GET /api/admin/categories — all categories (including inactive) with their
 * live quota counts.
 *
 * POST /api/admin/categories — creates a category. Admin only.
 */
import { NextResponse } from "next/server";
import { createCategory, listCategoriesWithQuota } from "@/services/leads";
import { errorJson } from "@/lib/api";
import { requestMetadata, requireRole } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/csrf";

export async function GET() {
  try {
    const { user } = await requireRole("admin");
    const categories = await listCategoriesWithQuota(true);
    return NextResponse.json(
      { categories },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertCsrf(request.headers.get("x-csrf-token"));
    const { user } = await requireRole("admin");
    const meta = await requestMetadata();

    const body = await request.json().catch(() => null);
    const category = await createCategory({ ...user }, body ?? {}, meta);

    return NextResponse.json(
      { category },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorJson(error);
  }
}