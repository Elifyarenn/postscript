/**
 * GET /api/cron/mail — delivers what is due in the e-mail outbox (D-269).
 *
 * The Hobby plan runs Vercel Cron once a day, and the daily run already works
 * the queue. This route exists for a more frequent outside scheduler (any
 * service that can send the `CRON_SECRET` bearer header every few minutes),
 * which is what a bulk send of thousands needs to finish within the hour. It is
 * a webhook in the sense of the style rules, closed while `CRON_SECRET` is unset.
 */
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { isCronRequestAuthorised } from "@/lib/cron";
import { env } from "@/lib/env";
import { unauthorized } from "@/lib/errors";
import { processMailQueue } from "@/services/mail-queue";
import { announceOpenedIssueWindows } from "@/services/issue-mail";

// Two sends a second leave room for about 400 mails in one run
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequestAuthorised(request.headers.get("authorization"), env().CRON_SECRET)) {
    return errorJson(unauthorized("Zamanlanmış iş isteği doğrulanamadı."));
  }

  // A topic or delivery window that opened since the last run is queued first (D-270, D-272)
  const announced = await announceOpenedIssueWindows();
  // Counts only: the response is kept in Vercel's logs
  const result = await processMailQueue({ budgetMs: 240_000, limit: 1000 });
  return NextResponse.json({ ok: true, announced, ...result }, { headers: { "cache-control": "no-store" } });
}
