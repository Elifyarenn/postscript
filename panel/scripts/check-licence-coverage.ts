/**
 * Lists the works whose signed licence would not cover their current text at
 * the publish step (D-347, D-350). Read only; safe against production:
 *   pnpm exec neon-env run -- pnpm check-licence-coverage
 * Exits 1 when any work would be stopped, so it can gate a release.
 */
import { licenceCoverageReport } from "@/services/rights";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const report = await licenceCoverageReport();
  const blocked = report.filter((row) => !row.result.ok);

  console.log(`Signed licences checked: ${report.length}; covered: ${report.length - blocked.length}.`);
  for (const row of blocked) {
    const reason = row.result.ok ? "" : row.result.reason;
    console.log(`  ✗ [${row.status}] ${row.title} (${row.articleId}): ${reason}`);
  }
  if (blocked.length > 0) process.exitCode = 1;
});
