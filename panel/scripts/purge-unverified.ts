/**
 * Removes accounts whose e-mail address was never verified (D-066).
 *
 * A registration that is not confirmed within the grace period is dead weight:
 * it can do nothing (D-034), it clutters the admin user list, and the address
 * it holds does not belong to a proven owner. The account is anonymised and
 * soft deleted exactly like a user-requested deletion; signed rights grants
 * cannot exist for an unverified account, so nothing of legal value is lost.
 *
 * Expired pending registrations (D-067) are dropped in the same run: they hold
 * a password hash and a birth date, so they must not outlive their link.
 *
 * Production runs this daily through /api/cron/daily (D-103); the script is for
 * a manual run against the same service function.
 */
import { purgeUnverifiedAccounts } from "@/services/housekeeping";
import { runScript } from "./_bootstrap";

runScript(async () => {
  const result = await purgeUnverifiedAccounts(new Date());
  console.log(
    `Purged ${result.accounts} unverified account(s) and ` +
      `${result.pendingRegistrations} expired pending registration(s).`,
  );
});
