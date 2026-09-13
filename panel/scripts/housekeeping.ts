/**
 * Runs the whole daily housekeeping by hand, exactly as /api/cron/daily does (D-103).
 * Useful after an outage of the scheduler, or to check a branch before a release.
 */
import { runDailyHousekeeping } from "@/services/housekeeping";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const outcomes = await runDailyHousekeeping(new Date());
  for (const outcome of outcomes) {
    const detail = outcome.ok ? JSON.stringify(outcome.result) : `FAILED: ${outcome.error}`;
    console.log(`  · ${outcome.name}: ${detail}`);
  }
  // A non-zero exit lets a wrapper notice that something needs attention
  if (outcomes.some((outcome) => !outcome.ok)) process.exitCode = 1;
});
