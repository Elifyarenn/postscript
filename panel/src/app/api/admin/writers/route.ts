/**
 * GET /api/admin/writers — every writer-lead with its chosen categories.
 * Admin only.
 */
import { NextResponse } from "next/server";
import { listLeads } from "@/services/leads";
import { errorJson } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";

export async function GET() {
  try {
    const { user } = await requireRole("admin");
    const leads = await listLeads({ ...user }, 200);
    return NextResponse.json({ leads }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}