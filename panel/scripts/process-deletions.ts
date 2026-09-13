/**
 * Carries out account deletion requests that are 30 days old (§5.4).
 *
 * Personal data is replaced, but signed rights grants and their signature
 * evidence stay: they are the proof that the magazine may publish the work,
 * which is a lawful basis for keeping them.
 *
 * Production runs this daily through /api/cron/daily (D-103); the script is for
 * a manual run against the same service function.
 */
import { processDueDeletions } from "@/services/housekeeping";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const processed = await processDueDeletions(new Date());
  // Counts only: the addresses of deleted accounts must not end up in a terminal log
  console.log(`Processed ${processed} deletion request(s).`);
});
