/** GET /api/public/issues/:number — one issue with its ordered contents (§10). */
import { getPublishedIssue } from "@/services/public";
import { errorJson, publicJson } from "@/lib/api";
import { badRequest } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  try {
    const { number } = await params;
    const parsed = Number(number);
    // Above the int4 column range Postgres would throw and the caller would see a 500 (D-253)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
      throw badRequest("Sayı numarası geçersiz.");
    }

    return publicJson(await getPublishedIssue(parsed), request);
  } catch (error) {
    return errorJson(error);
  }
}
