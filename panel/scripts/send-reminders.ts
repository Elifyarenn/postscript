/**
 * Reminds writers about work approvals that have been waiting three days
 * (§12). A writer is not reminded again within another three days.
 * Suggested cron: once a day.
 */
import { sendApprovalReminders } from "@/services/rights";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const count = await sendApprovalReminders(new Date());
  console.log(`Sent ${count} reminder(s).`);
});
