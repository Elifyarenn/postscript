/**
 * Announcements and their acknowledgements (§9.1 and §9.2).
 *
 * An announcement marked `requires_acknowledgement` locks the rest of the
 * writer panel until it is acknowledged. The agreement page is deliberately
 * exempt, otherwise a writer could be locked out of both at once.
 */
import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { announcementReads, announcements, users, type Announcement } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, hasRole, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import * as templates from "@emails/templates";
import type { RequestMeta } from "./auth";

export const announcementSchema = z.strictObject({
  title: z.string().trim().min(3).max(200),
  bodyMarkdown: z.string().trim().min(3).max(20_000),
  audience: z.enum(["writers", "editors", "all_staff"]),
  requiresAcknowledgement: z.boolean(),
  pinned: z.boolean(),
});

/** Which audiences a given role is part of. */
function audiencesFor(actor: Actor): ("writers" | "editors" | "all_staff")[] {
  if (hasRole(actor.role, "editor")) return ["editors", "all_staff", "writers"];
  if (hasRole(actor.role, "writer")) return ["writers", "all_staff"];
  return [];
}

export async function listAnnouncementsFor(actor: Actor) {
  const audiences = audiencesFor(actor);
  if (audiences.length === 0) return [];

  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      bodyMarkdown: announcements.bodyMarkdown,
      audience: announcements.audience,
      requiresAcknowledgement: announcements.requiresAcknowledgement,
      pinned: announcements.pinned,
      publishedAt: announcements.publishedAt,
      readAt: announcementReads.readAt,
      acknowledgedAt: announcementReads.acknowledgedAt,
    })
    .from(announcements)
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.announcementId, announcements.id),
        eq(announcementReads.userId, actor.id),
      ),
    )
    .where(
      and(
        isNull(announcements.deletedAt),
        isNotNull(announcements.publishedAt),
        inArray(announcements.audience, audiences),
      ),
    )
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt));
}

/**
 * Announcements this user must acknowledge before the rest of the panel opens.
 * The caller turns a non-empty result into a redirect.
 */
export async function pendingAcknowledgements(actor: Actor) {
  const all = await listAnnouncementsFor(actor);
  return all.filter((row) => row.requiresAcknowledgement && row.acknowledgedAt === null);
}

export async function markRead(actor: Actor, announcementId: string): Promise<void> {
  await db
    .insert(announcementReads)
    .values({ announcementId, userId: actor.id })
    .onConflictDoNothing();
}

export async function acknowledge(
  actor: Actor,
  announcementId: string,
  meta: RequestMeta,
): Promise<void> {
  const rows = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, announcementId), isNull(announcements.deletedAt)))
    .limit(1);
  if (rows.length === 0) throw notFound("Duyuru bulunamadı.");

  const now = new Date();
  await db
    .insert(announcementReads)
    .values({ announcementId, userId: actor.id, readAt: now, acknowledgedAt: now })
    .onConflictDoUpdate({
      target: [announcementReads.announcementId, announcementReads.userId],
      set: { acknowledgedAt: now, updatedAt: now },
    });

  await writeAudit({
    actorId: actor.id,
    action: "announcement.acknowledged",
    entityType: "announcements",
    entityId: announcementId,
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Authoring                                                           */
/* ------------------------------------------------------------------ */

export async function createAnnouncement(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<Announcement> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const parsed = announcementSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Duyuru geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const [row] = await db.insert(announcements).values(parsed.data).returning();

  await writeAudit({
    actorId: actor.id,
    action: "announcement.created",
    entityType: "announcements",
    entityId: row!.id,
    after: { title: row!.title, audience: row!.audience },
    ip: meta.ip,
  });

  return row!;
}

export async function publishAnnouncement(
  actor: Actor,
  announcementId: string,
  meta: RequestMeta,
): Promise<Announcement> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const rows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);
  const existing = rows[0];
  if (!existing) throw notFound("Duyuru bulunamadı.");
  if (existing.publishedAt) throw conflict("Bu duyuru zaten yayınlanmış.");

  const now = new Date();
  const [published] = await db
    .update(announcements)
    .set({ publishedAt: now, publishedBy: actor.id, updatedAt: now })
    .where(eq(announcements.id, announcementId))
    .returning();

  // §12: a mandatory announcement is also mailed, because it blocks the panel
  if (published!.requiresAcknowledgement) {
    const recipients = await db
      .select({ email: users.email, displayName: users.displayName })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          published!.audience === "editors"
            ? inArray(users.role, ["editor", "admin"])
            : published!.audience === "writers"
              ? eq(users.role, "writer")
              : inArray(users.role, ["writer", "editor", "admin"]),
        ),
      );

    for (const recipient of recipients) {
      const message = templates.mandatoryAnnouncement({
        displayName: recipient.displayName,
        title: published!.title,
        url: `${env().APP_URL}/writer/announcements`,
      });
      await sendMail({ to: recipient.email, subject: message.subject, text: message.text });
    }
  }

  await writeAudit({
    actorId: actor.id,
    action: "announcement.published",
    entityType: "announcements",
    entityId: announcementId,
    after: { audience: published!.audience, requiresAcknowledgement: published!.requiresAcknowledgement },
    ip: meta.ip,
  });

  return published!;
}

/** Read report for the editor panel: who has seen and who has acknowledged. */
export async function readReport(actor: Actor, announcementId: string) {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      readAt: announcementReads.readAt,
      acknowledgedAt: announcementReads.acknowledgedAt,
    })
    .from(users)
    .leftJoin(
      announcementReads,
      and(
        eq(announcementReads.userId, users.id),
        eq(announcementReads.announcementId, announcementId),
      ),
    )
    .where(and(isNull(users.deletedAt), ne(users.role, "user")))
    .orderBy(users.displayName);
}

export async function listAllAnnouncements(actor: Actor) {
  if (!canAccessEditorPanel(actor)) throw forbidden();
  return db
    .select()
    .from(announcements)
    .where(isNull(announcements.deletedAt))
    .orderBy(desc(announcements.createdAt));
}
