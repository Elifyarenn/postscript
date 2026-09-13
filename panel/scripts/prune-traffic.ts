/**
 * Deletes traffic records that have served their statutory year (D-088).
 *
 * 5651 m. 5 obliges the magazine to keep them for one year; the KVKK notice
 * promises they are not kept longer. Only this script deletes from the table.
 *
 * Suggested cron: once a day.
 */
import { pruneTrafficLogs } from "@/lib/traffic";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const removed = await pruneTrafficLogs();
  console.log(`Pruned ${removed} traffic record(s) older than one year.`);
});
