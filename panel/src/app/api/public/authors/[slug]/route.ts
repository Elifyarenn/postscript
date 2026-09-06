/**
 * GET /api/public/authors/:penNameSlug — public author profile.
 * The e-mail address, legal name and birth date are never part of the payload.
 */
import { getPublicAuthor } from "@/services/public";
import { errorJson, publicJson } from "@/lib/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    return publicJson(await getPublicAuthor(slug), request);
  } catch (error) {
    return errorJson(error);
  }
}
