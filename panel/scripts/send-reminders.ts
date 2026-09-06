/**
 * Reminds writers about rights grant forms that have been waiting three days
 * (§12). A writer is not reminded again within another three days.
 * Suggested cron: once a day.
 */
import { sendGrantReminders } from "@/services/rights";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const count = await sendGrantReminders(new Date());
  console.log(`Sent ${count} reminder(s).`);
});
