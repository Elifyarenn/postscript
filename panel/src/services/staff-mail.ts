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
import { sendMail } from "@/lib/mail/transport";
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

    for (const admin of admins) {
      await sendMail({ to: admin.email, subject: message.subject, text: message.text });
    }
  } catch (error) {
    console.error(`Admin mail failed for subject "${message.subject}"`, error);
  }
}
