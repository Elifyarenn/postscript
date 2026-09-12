/**
 * Removes accounts whose e-mail address was never verified (D-066).
 *
 * A registration that is not confirmed within the grace period is dead weight:
 * it can do nothing (D-034), it clutters the admin user list, and the address
 * it holds does not belong to a proven owner. The account is anonymised and
 * soft deleted exactly like a user-requested deletion; signed rights grants
 * cannot exist for an unverified account, so nothing of legal value is lost.
 *
 * Suggested cron: once a day.
 */
import { and, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { anonymiseUser } from "@/services/users";
import { runScript } from "./_bootstrap";

/** The verification link lives 24 hours; a week leaves room to ask for another. */
const GRACE_DAYS = 7;

runScript(async () => {
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000);

  const stale = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        isNull(users.emailVerifiedAt),
        isNull(users.deletedAt),
        lte(users.createdAt, cutoff),
      ),
    );

  if (stale.length === 0) {
    console.log("No unverified accounts were due.");
    return;
  }

  for (const account of stale) {
    await anonymiseUser(account.id);
    console.log(`  · anonymised ${account.email}`);
  }

  console.log(`Purged ${stale.length} unverified account(s).`);
});
