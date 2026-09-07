/**
 * GET /api/categories — the active writing categories with their live quota
 * (current_count / max_quota) and availability, for the public interest form.
 */
import { listCategoriesWithQuota } from "@/services/leads";
import { errorJson, publicJson } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const categories = await listCategoriesWithQuota(false);
    return publicJson({ categories }, request, { maxAge: 10, staleWhileRevalidate: 60 });
  } catch (error) {
    return errorJson(error);
  }
}