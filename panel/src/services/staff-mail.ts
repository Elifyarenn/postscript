/**
 * E-mail to the admins (D-098).
 *
 * The in-panel notification only reaches an admin who opens the panel. Some
 * queues run on a clock (5651 m. 9 gives a report 24 hours), so the admins
 * also get a mail they will see on their phone.
 */
import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { queueMails } from "@/services/mail-queue";
import type { Template } from "@emails/templates";

/**
 * Sends the same message to every active admin. Never throws: it runs after
 * the change it announces has been saved, and a failed lookup must not turn
 * a saved report into an error on the member's screen.
 */
export async function mailAdmins(message: Template): Promise<void> {
  try {
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isBanned, false),
          isNull(users.deletedAt),
          isNotNull(users.emailVerifiedAt),
        ),
      );

    await queueMails(admins.map((admin) => ({ to: admin.email, ...message })));
  } catch (error) {
    // First line only: driver errors carry the query parameters (addresses) after it
    const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    console.error(`Admin mail failed (${message.kind}): ${reason}`);
  }
}
