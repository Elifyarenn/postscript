/** GET /api/public/issues — published issues, newest first (§10). */
import { listPublishedIssues } from "@/services/public";
import { errorJson, publicJson } from "@/lib/api";

export async function GET(request: Request) {
  try {
    return publicJson({ issues: await listPublishedIssues() }, request);
  } catch (error) {
    return errorJson(error);
  }
}
