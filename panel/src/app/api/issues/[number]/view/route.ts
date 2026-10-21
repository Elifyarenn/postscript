/**
 * POST /api/issues/:number/view — the reader counts an opening (D-344).
 *
 * The browser sends it once a day per issue; the server adds one to that
 * day's number and stores nothing about who sent it. A closed issue answers
 * 404 like its reader.
 */
import { NextResponse } from "next/server";
import { readerSession } from "@/lib/auth/guard";
import { assertSameOrigin } from "@/lib/csrf";
import { errorJson } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { recordIssueView } from "@/services/issue-views";

export async function POST(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    // Only the magazine's own reader counts; another site cannot add to it
    await assertSameOrigin();
    const number = Number((await params).number);
    if (!Number.isInteger(number) || number < 1 || number > 2_147_483_647) throw notFound("Sayı bulunamadı.");

    // Asked only so the team's visits are left out
    const context = await readerSession();
    const result = await recordIssueView(context ? { ...context.user } : null, number);
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}
