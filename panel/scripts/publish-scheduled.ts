/**
 * Publishes articles whose scheduled time has arrived (DECISIONS.md D-010).
 * Idempotent, so it is safe to run from cron every few minutes:
 *   * / 5 * * * *  cd /app && pnpm publish-scheduled
 */
import { publishScheduledArticles } from "@/services/articles";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const published = await publishScheduledArticles(new Date());

  if (published.length === 0) {
    console.log("No scheduled articles were due.");
    return;
  }
  console.log(`Published ${published.length} article(s):`);
  for (const slug of published) console.log(`  · ${slug}`);
});
