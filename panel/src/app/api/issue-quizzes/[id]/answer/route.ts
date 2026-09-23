/**
 * POST /api/issue-quizzes/:id/answer — marks a reader's answers (D-240).
 *
 * Grading happens here, not in the browser, so the answer key never travels.
 * The reader sends which option they chose for each question and gets back how
 * they did; nothing about the attempt is stored, so a reader can try a quiz as
 * often as they like without leaving a record of it anywhere.
 *
 * The same door the issue itself has: a quiz from a closed issue answers 404,
 * whoever asks and however they got the id.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/csrf";
import { errorJson } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { quizAnswerSchema } from "@/lib/issue-quiz";
import { answerQuiz } from "@/services/issue-quizzes";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Marking answers stores nothing, so the double-submit token would only
    // be ceremony; the origin check still keeps it off other people's pages
    await assertSameOrigin();
    const { user } = await requireAuth();
    const { id } = await params;

    const body: unknown = await request.json().catch(() => null);
    const parsed = quizAnswerSchema.safeParse(
      body && typeof body === "object" ? (body as { answers?: unknown }).answers : null,
    );
    if (!parsed.success) throw badRequest("Cevaplar okunamadı.");

    const result = await answerQuiz({ ...user }, id, parsed.data);
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}
