/**
 * Content reports (D-090): a member flags a post, a comment or an account;
 * the admin decides within twenty-four hours (5651 m. 9).
 *
 * The reporter is never shown to the reported member. The report keeps a
 * snapshot of the text, so the decision rests on what was actually reported.
 * Deciding one report decides every open report about the same content.
 */
import "server-only";
import { and, asc, desc, eq, isNull, lt, ne, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  anonMessages,
  communityComments,
  contentReports,
  conversations,
  directMessages,
  posts,
  users,
  type ReportTarget,
} from "@/db/schema";
import { writeAudit, type Executor } from "@/lib/audit";
import { canModerateCommunity, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import {
  isReportOverdue,
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_TARGET_LABELS,
} from "@/lib/reports";
import { trafficCutoff } from "@/lib/traffic";
import { assertMayPost } from "./community";
import { notify } from "./notifications";
import { mailAdmins } from "./staff-mail";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

export const MAX_REPORT_REASON = 1000;

/** What can be reported today; later modules add their own kinds. */
export const REPORTABLE_TARGETS = [
  "post",
  "comment",
  "direct_message",
  "anon_message",
  "member",
] as const;

export const reportSchema = z.strictObject({
  targetType: z.enum(REPORTABLE_TARGETS),
  targetId: z.uuid("Bildirilen içerik geçersiz."),
  category: z.enum(REPORT_CATEGORIES, "Bir bildirim türü seçin."),
  reason: z.string().trim().max(MAX_REPORT_REASON).optional().nullable(),
});

type ResolvedTarget = { ownerId: string | null; snapshot: string };

/** What a report points at, as it stands now. Content already gone cannot be reported. */
async function resolveTarget(
  type: ReportTarget,
  id: string,
  reporterId: string,
): Promise<ResolvedTarget> {
  switch (type) {
    case "anon_message": {
      // Only the recipient can report it. The sender is recorded as the owner,
      // which is the one moment a moderator learns who wrote it (D-092)
      const rows = await db
        .select({ ownerId: anonMessages.senderId, snapshot: anonMessages.body })
        .from(anonMessages)
        .where(
          and(
            eq(anonMessages.id, id),
            eq(anonMessages.recipientId, reporterId),
            isNull(anonMessages.deletedAt),
          ),
        )
        .limit(1);
      if (!rows[0]) throw notFound("Mesaj bulunamadı.");
      return rows[0];
    }
    case "direct_message": {
      // Only one of the two members can report a private message; to anyone
      // else it does not exist (D-091)
      const rows = await db
        .select({ ownerId: directMessages.senderId, snapshot: directMessages.body })
        .from(directMessages)
        .innerJoin(conversations, eq(directMessages.conversationId, conversations.id))
        .where(
          and(
            eq(directMessages.id, id),
            isNull(directMessages.deletedAt),
            or(eq(conversations.memberAId, reporterId), eq(conversations.memberBId, reporterId)),
          ),
        )
        .limit(1);
      if (!rows[0]) throw notFound("Mesaj bulunamadı.");
      return rows[0];
    }
    case "post": {
      const rows = await db
        .select({ ownerId: posts.authorId, snapshot: posts.body })
        .from(posts)
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
        .limit(1);
      if (!rows[0]) throw notFound("Gönderi bulunamadı.");
      return rows[0];
    }
    case "comment": {
      const rows = await db
        .select({ ownerId: communityComments.authorId, snapshot: communityComments.body })
        .from(communityComments)
        .where(and(eq(communityComments.id, id), isNull(communityComments.deletedAt)))
        .limit(1);
      if (!rows[0]) throw notFound("Yorum bulunamadı.");
      return rows[0];
    }
    case "member": {
      const rows = await db
        .select({ ownerId: users.id, username: users.username, bio: users.bio })
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .limit(1);
      if (!rows[0]?.username) throw notFound("Hesap bulunamadı.");
      // What the reporter saw of the account: its handle and its biography
      const snapshot = [`@${rows[0].username}`, rows[0].bio].filter(Boolean).join("\n\n");
      return { ownerId: rows[0].ownerId, snapshot };
    }
    default:
      throw badRequest("Bu içerik türü bildirilemez.");
  }
}

export async function reportContent(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<{ id: string; duplicate: boolean }> {
  assertMayPost(actor);

  const parsed = reportSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Bildirim geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const input = parsed.data;

  const target = await resolveTarget(input.targetType, input.targetId, actor.id);
  if (target.ownerId === actor.id) throw badRequest("Kendi içeriğinizi bildiremezsiniz.");

  // Reporting the same thing twice adds nothing to a queue that is still open
  const existing = await db
    .select({ id: contentReports.id })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.reporterId, actor.id),
        eq(contentReports.targetType, input.targetType),
        eq(contentReports.targetId, input.targetId),
        eq(contentReports.status, "open"),
      ),
    )
    .limit(1);
  if (existing[0]) return { id: existing[0].id, duplicate: true };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contentReports)
      .values({
        reporterId: actor.id,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: target.ownerId,
        category: input.category,
        reason: input.reason || null,
        snapshot: target.snapshot,
      })
      .returning({ id: contentReports.id });

    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt), eq(users.isBanned, false)));
    for (const admin of admins) {
      await notify(
        {
          userId: admin.id,
          kind: "moderation.report",
          title: "Yeni içerik bildirimi: en geç 24 saat içinde sonuçlandırılmalı.",
          href: "/admin/community/reports",
        },
        tx,
      );
    }

    await writeAudit(
      {
        actorId: actor.id,
        action: "moderation.report_created",
        entityType: "content_reports",
        entityId: row!.id,
        after: { targetType: input.targetType, targetId: input.targetId, category: input.category },
        ip: meta.ip,
      },
      tx,
    );

    return { id: row!.id, duplicate: false };
  });

  // Only after the commit, so a rolled back report mails nobody. The mail
  // names the kinds alone; the text and both accounts stay in the panel (D-098)
  await mailAdmins(
    templates.adminReportReceived({
      target: REPORT_TARGET_LABELS[input.targetType],
      category: REPORT_CATEGORY_LABELS[input.category],
      url: `${env().APP_URL}/admin/community`,
    }),
  );

  return created;
}

/* ------------------------------------------------------------------ */
/* The moderation queue                                                */
/* ------------------------------------------------------------------ */

export async function listReports(actor: Actor, state: "open" | "closed", limit = 200) {
  if (!canModerateCommunity(actor)) throw forbidden();

  const reporter = alias(users, "reporter");
  const owner = alias(users, "owner");
  const condition: SQL =
    state === "open" ? eq(contentReports.status, "open") : ne(contentReports.status, "open");

  const rows = await db
    .select({
      id: contentReports.id,
      targetType: contentReports.targetType,
      targetId: contentReports.targetId,
      category: contentReports.category,
      reason: contentReports.reason,
      snapshot: contentReports.snapshot,
      status: contentReports.status,
      createdAt: contentReports.createdAt,
      resolvedAt: contentReports.resolvedAt,
      resolutionNote: contentReports.resolutionNote,
      reporterName: reporter.displayName,
      reporterUsername: reporter.username,
      ownerName: owner.displayName,
      ownerUsername: owner.username,
    })
    .from(contentReports)
    .leftJoin(reporter, eq(contentReports.reporterId, reporter.id))
    .leftJoin(owner, eq(contentReports.targetUserId, owner.id))
    .where(condition)
    // Open reports oldest first, so the nearest deadline is on top
    .orderBy(state === "open" ? asc(contentReports.createdAt) : desc(contentReports.resolvedAt))
    .limit(limit);

  const now = new Date();
  return rows.map((row) => ({
    ...row,
    overdue: row.status === "open" && isReportOverdue(row.createdAt, now),
  }));
}

export const resolveReportSchema = z.strictObject({
  reportId: z.uuid(),
  decision: z.enum(["remove", "dismiss"], "Bir karar seçin."),
  note: z.string().trim().max(1000).optional().nullable(),
});

async function removeTarget(
  executor: Executor,
  type: ReportTarget,
  id: string,
  moderatorId: string,
): Promise<void> {
  const now = new Date();
  switch (type) {
    case "post":
      await executor
        .update(posts)
        .set({ deletedAt: now, removedBy: moderatorId, updatedAt: now })
        .where(and(eq(posts.id, id), isNull(posts.deletedAt)));
      return;
    case "comment":
      await executor
        .update(communityComments)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(communityComments.id, id), isNull(communityComments.deletedAt)));
      return;
    case "direct_message":
      await executor
        .update(directMessages)
        .set({ deletedAt: now, removedBy: moderatorId, updatedAt: now })
        .where(and(eq(directMessages.id, id), isNull(directMessages.deletedAt)));
      return;
    case "anon_message":
      await executor
        .update(anonMessages)
        .set({ deletedAt: now, removedBy: moderatorId, updatedAt: now })
        .where(and(eq(anonMessages.id, id), isNull(anonMessages.deletedAt)));
      return;
    default:
      throw badRequest(
        "Hesap bildirimi içerik kaldırmayla sonuçlanamaz; gerekirse hesabı kullanıcı sayfasından askıya alın.",
      );
  }
}

export async function resolveReport(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  if (!canModerateCommunity(actor)) throw forbidden();

  const parsed = resolveReportSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Karar geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const { reportId, decision, note } = parsed.data;

  const rows = await db.select().from(contentReports).where(eq(contentReports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw notFound("Bildirim bulunamadı.");
  if (report.status !== "open") throw conflict("Bu bildirim zaten sonuçlandırılmış.");

  const status = decision === "remove" ? "removed" : "dismissed";
  const now = new Date();

  await db.transaction(async (tx) => {
    if (decision === "remove") {
      await removeTarget(tx, report.targetType, report.targetId, actor.id);
    }

    const closed = await tx
      .update(contentReports)
      .set({
        status,
        resolvedBy: actor.id,
        resolvedAt: now,
        resolutionNote: note || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(contentReports.targetType, report.targetType),
          eq(contentReports.targetId, report.targetId),
          eq(contentReports.status, "open"),
        ),
      )
      .returning({ reporterId: contentReports.reporterId });

    // The reporter learns the outcome, never who decided it
    const reporters = new Set(
      closed.map((row) => row.reporterId).filter((id): id is string => id !== null),
    );
    for (const reporterId of reporters) {
      await notify(
        {
          userId: reporterId,
          kind: "moderation.report_resolved",
          title:
            status === "removed"
              ? "Bildirdiğiniz içerik incelendi ve kaldırıldı."
              : "Bildirdiğiniz içerik incelendi; kurallara aykırı bulunmadı.",
        },
        tx,
      );
    }

    await writeAudit(
      {
        actorId: actor.id,
        action: "moderation.report_resolved",
        entityType: "content_reports",
        entityId: report.id,
        after: { decision, targetType: report.targetType, targetId: report.targetId, closed: closed.length },
        ip: meta.ip,
      },
      tx,
    );
  });
}

/** Closed reports past their year; open ones are never pruned. */
export async function pruneResolvedReports(now: Date = new Date()): Promise<number> {
  const removed = await db
    .delete(contentReports)
    .where(and(ne(contentReports.status, "open"), lt(contentReports.resolvedAt, trafficCutoff(now))))
    .returning({ id: contentReports.id });
  return removed.length;
}
