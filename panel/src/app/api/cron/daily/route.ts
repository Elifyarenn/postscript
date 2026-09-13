/**
 * GET /api/cron/daily — the daily housekeeping run, invoked by Vercel Cron (D-103).
 *
 * A webhook in the sense of the style rules: there is no user and no form, only
 * the shared secret Vercel sends. The response lists each task and whether it
 * succeeded, never an error message, because Vercel keeps response bodies in
 * its logs.
 */
import { NextResponse } from "next/server";
import { errorJson } from "@/lib/api";
import { isCronRequestAuthorised } from "@/lib/cron";
import { env } from "@/lib/env";
import { unauthorized } from "@/lib/errors";
import { runDailyHousekeeping } from "@/services/housekeeping";

// Anonymising accounts and pruning a year of records can outlast the default limit
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronRequestAuthorised(request.headers.get("authorization"), env().CRON_SECRET)) {
    return errorJson(unauthorized("Zamanlanmış iş isteği doğrulanamadı."));
  }

  const outcomes = await runDailyHousekeeping(new Date());
  const allOk = outcomes.every((outcome) => outcome.ok);

  return NextResponse.json(
    {
      ok: allOk,
      tasks: outcomes.map((outcome) =>
        outcome.ok
          ? { name: outcome.name, ok: true, result: outcome.result }
          : { name: outcome.name, ok: false },
      ),
    },
    // A 500 makes Vercel mark the invocation as failed, so a broken task is visible
    { status: allOk ? 200 : 500, headers: { "cache-control": "no-store" } },
  );
}
