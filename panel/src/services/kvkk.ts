/**
 * The KVKK notice: publishing a version and telling members about it (D-104).
 *
 * The notice informs, it does not ask for consent (D-083), so a new version
 * never locks anyone out. A member sees a banner until they say they have read
 * it; a material change also reaches them as a notification and an e-mail,
 * which is what the notice's own §10 promises.
 */
import "server-only";
import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { kvkkVersions, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { hasRole, type Actor } from "@/lib/auth/rbac";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import * as templates from "@emails/templates";
import { notify } from "@/services/notifications";
import type { RequestMeta } from "./auth";

export const publishKvkkSchema = z.strictObject({
  title: z.string().trim().min(3).max(200),
  bodyMarkdown: z.string().trim().min(50, "Aydınlatma metni çok kısa.").max(100_000),
  /** A material change (notice §10): members also get a notification and an e-mail. */
  notifyMembers: z.boolean(),
});

export type CurrentKvkk = { version: number; title: string };

export async function currentKvkk(): Promise<CurrentKvkk | null> {
  const rows = await db
    .select({ version: kvkkVersions.version, title: kvkkVersions.title })
    .from(kvkkVersions)
    .where(eq(kvkkVersions.isCurrent, true))
    .limit(1);
  return rows[0] ?? null;
}

/** True while the member has not yet said they read the current notice. */
export function needsKvkkNotice(readVersion: number | null, current: CurrentKvkk | null): boolean {
  if (!current) return false;
  return readVersion === null || readVersion < current.version;
}

/**
 * Publishes a new version; the previous one stops being current. Members are
 * told only when the admin marks the change as material, so fixing a typo does
 * not send every member an e-mail.
 */
export async function publishKvkkVersion(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ version: number; notified: number }> {
  if (!hasRole(actor.role, "admin")) throw forbidden();

  const parsed = publishKvkkSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Aydınlatma metni geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  const version = await db.transaction(async (tx) => {
    const latest = await tx
      .select({ version: kvkkVersions.version })
      .from(kvkkVersions)
      .orderBy(desc(kvkkVersions.version))
      .limit(1);
    const next = (latest[0]?.version ?? 0) + 1;

    // Only one row may be current, so the old one is cleared first
    await tx
      .update(kvkkVersions)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(and(eq(kvkkVersions.isCurrent, true), ne(kvkkVersions.version, next)));

    const [row] = await tx
      .insert(kvkkVersions)
      .values({
        version: next,
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        bodyHash: sha256Hex(input.bodyMarkdown),
        publishedAt: new Date(),
        publishedBy: actor.id,
        isCurrent: true,
      })
      .returning({ id: kvkkVersions.id });

    await writeAudit(
      {
        actorId: actor.id,
        action: "kvkk.version_published",
        entityType: "kvkk_versions",
        entityId: row!.id,
        after: { version: next, notifyMembers: input.notifyMembers },
        ip: meta.ip,
      },
      tx,
    );
    return next;
  });

  // After the commit: a rolled back version must not reach anyone's inbox
  const notified = input.notifyMembers ? await tellMembers(version) : 0;
  return { version, notified };
}

/**
 * Notifies and mails every member who can sign in. Never throws: the version
 * is already published, and a mail outage must not show the admin a failure
 * for something that succeeded.
 */
async function tellMembers(version: number): Promise<number> {
  try {
    const members = await db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(and(isNull(users.deletedAt), isNotNull(users.emailVerifiedAt)));

    const url = `${env().APP_URL}/kvkk`;
    for (const member of members) {
      await notify({
        userId: member.id,
        kind: "kvkk.new_version",
        title: `KVKK aydınlatma metni güncellendi (sürüm ${version})`,
        href: "/kvkk",
      });
      const message = templates.kvkkNewVersion({ displayName: member.displayName, version, url });
      await sendMail({ to: member.email, subject: message.subject, text: message.text });
    }
    return members.length;
  } catch (error) {
    // First line only: driver errors carry query parameters (addresses) after it
    const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
    console.error(`KVKK notice fan-out failed for version ${version}: ${reason}`);
    return 0;
  }
}

/**
 * Records that the member read the current notice. The previous version and
 * time go to the append-only audit log first, so the registration record is
 * not lost when the columns move on.
 */
export async function acknowledgeKvkkNotice(
  actor: Actor,
  rawVersion: unknown,
  meta: RequestMeta,
): Promise<void> {
  const parsed = z.coerce.number().int().positive().safeParse(rawVersion);
  if (!parsed.success) throw badRequest("Geçersiz sürüm.");
  const version = parsed.data;

  const current = await currentKvkk();
  // A banner rendered before a newer version went out must not mark the newer one as read
  if (!current || current.version !== version) {
    throw conflict("Aydınlatma metni bu arada güncellendi; sayfayı yenileyip yeni metni okuyun.");
  }

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ version: users.kvkkConsentVersion, at: users.kvkkConsentAt })
      .from(users)
      .where(eq(users.id, actor.id))
      .limit(1);

    // A double click submits twice; the second one has nothing left to record
    if (before?.version !== null && before?.version !== undefined && before.version >= version) {
      return;
    }

    await tx
      .update(users)
      .set({ kvkkConsentVersion: version, kvkkConsentAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, actor.id));

    await writeAudit(
      {
        actorId: actor.id,
        action: "user.kvkk_notice_read",
        entityType: "users",
        entityId: actor.id,
        before: { version: before?.version ?? null, at: before?.at ?? null },
        after: { version },
        ip: meta.ip,
      },
      tx,
    );
  });
}
