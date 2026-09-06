/**
 * GET /api/public/articles/:slug — a published article.
 * A withdrawn article answers 410; anything else unpublished answers 404 (§10).
 */
import { getPublicArticle } from "@/services/public";
import { errorJson, publicJson } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    return publicJson(await getPublicArticle(slug), request);
  } catch (error) {
    return errorJson(error);
  }
}
