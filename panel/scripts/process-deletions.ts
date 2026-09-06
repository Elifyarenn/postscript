/**
 * Carries out account deletion requests that are 30 days old (§5.4).
 *
 * Personal data is replaced, but signed rights grants and their signature
 * evidence stay: they are the proof that the magazine may publish the work,
 * which is a lawful basis for keeping them.
 *
 * Suggested cron: once a day.
 */
import { and, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { anonymiseUser } from "@/services/users";
import { runScript } from "./_bootstrap";

const RETENTION_DAYS = 30;

runScript(async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);

  const due = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        isNotNull(users.deletionRequestedAt),
        isNull(users.deletedAt),
        lte(users.deletionRequestedAt, cutoff),
      ),
    );

  if (due.length === 0) {
    console.log("No account deletions were due.");
    return;
  }

  for (const account of due) {
    await anonymiseUser(account.id);
    console.log(`  · anonymised ${account.email}`);
  }

  console.log(`Processed ${due.length} deletion request(s).`);
});
