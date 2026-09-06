/**
 * Work approvals — "Eser Onayı" (§7).
 *
 * The licence scope is not negotiated per work: it is fixed by article 4 of the
 * contract version the writer accepted. Nobody, editor included, can widen or
 * narrow it here. What the writer actually approves is *this text, under that
 * contract*, which is why the record stores the hash of the accepted article
 * body and the contract version it rests on.
 */
import "server-only";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  agreementVersions,
  articles,
  rightsGrants,
  users,
  type Article,
  type RightsGrant,
  type User,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, canSignRightsGrant, type Actor } from "@/lib/auth/rbac";
import { hashDocument } from "@/lib/agreement/normalise";
import { formatContractDateTime } from "@/lib/agreement/render";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { renderDocumentPdf } from "@/lib/pdf";
import * as templates from "@emails/templates";
import { storeGeneratedPdf } from "./media";
import { getCurrentAgreement } from "./agreements";
import type { RequestMeta } from "./auth";

/**
 * The licence exactly as article 4 of the contract states it. These are
 * constants, not defaults: §11 forbids making the per-work scope editable.
 */
export const LICENCE_TERMS = {
  grantType: "non_exclusive_license",
  rightReproduction: true,
  rightDistribution: true,
  rightCommunicationToPublic: true,
  // Limited to the operations listed in article 4.2
  rightAdaptation: true,
  channels: ["web", "pdf_issue", "social", "newsletter"],
  territory: "worldwide",
  exclusivityMonths: null,
  consideration: "none",
  commercialUseIncluded: false,
} as const;

/** The sentence the writer ticks; it is stored verbatim in the record PDF. */
export const APPROVAL_STATEMENT =
  "Bu eseri Sözleşme'nin 4. maddesindeki şartlarla ruhsatlıyorum.";

/** The hash of an article body, under the same normalisation as the contract. */
export function articleHash(bodyMarkdown: string): string {
  return hashDocument(bodyMarkdown);
}

/* ------------------------------------------------------------------ */
/* Opening an approval                                                 */
/* ------------------------------------------------------------------ */

/**
 * Called when an editor accepts an article (§7.1). Returns the approval that is
 * already open, if any, so accepting twice is harmless.
 */
export async function openApprovalForArticle(
  article: Article,
  options: { actorId: string | null; ip?: string | null } = { actorId: null },
): Promise<RightsGrant> {
  if (!article.authorId) {
    throw badRequest("Makaleye yazar atanmadan Eser Onayı açılamaz.");
  }

  const live = await findLiveApproval(article.id);
  if (live) return live;

  const agreement = await getCurrentAgreement();
  if (!agreement) {
    throw conflict("Yayınlanmış bir sözleşme sürümü yok; Eser Onayı açılamaz.");
  }

  const writer = await findWriter(article.authorId);

  const [grant] = await db
    .insert(rightsGrants)
    .values({
      articleId: article.id,
      grantorId: article.authorId,
      agreementVersionId: agreement.id,
      grantType: LICENCE_TERMS.grantType,
      rightAdaptation: LICENCE_TERMS.rightAdaptation,
      rightReproduction: LICENCE_TERMS.rightReproduction,
      rightDistribution: LICENCE_TERMS.rightDistribution,
      rightCommunicationToPublic: LICENCE_TERMS.rightCommunicationToPublic,
      channels: [...LICENCE_TERMS.channels],
      territory: LICENCE_TERMS.territory,
      exclusivityMonths: LICENCE_TERMS.exclusivityMonths,
      consideration: LICENCE_TERMS.consideration,
      commercialUseIncluded: LICENCE_TERMS.commercialUseIncluded,
      // Filled in at approval time with the hash of the text actually approved
      formTextHash: articleHash(article.bodyMarkdown),
      status: "pending",
    })
    .returning();

  const url = `${env().APP_URL}/writer/approvals`;
  const message = templates.rightsGrantPending({
    displayName: writer.displayName,
    articleTitle: article.title,
    url,
  });
  await sendMail({ to: writer.email, subject: message.subject, text: message.text });

  await writeAudit({
    actorId: options.actorId,
    action: "work_approval.opened",
    entityType: "rights_grants",
    entityId: grant!.id,
    after: { articleId: article.id, grantorId: article.authorId, agreementVersionId: agreement.id },
    ip: options.ip ?? null,
  });

  return grant!;
}

/**
 * Revokes the live approval, because the work it covered has changed (§7.5).
 * The revoked row stays as history.
 */
export async function revokeApproval(
  articleId: string,
  actorId: string | null,
  meta: RequestMeta,
): Promise<void> {
  const live = await findLiveApproval(articleId);
  if (!live) return;

  const now = new Date();
  await db
    .update(rightsGrants)
    .set({ status: "revoked", revokedAt: now, revokedBy: actorId, updatedAt: now })
    .where(eq(rightsGrants.id, live.id));

  await writeAudit({
    actorId,
    action: "work_approval.revoked",
    entityType: "rights_grants",
    entityId: live.id,
    before: { status: live.status },
    after: { reason: "content_change" },
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export async function findGrant(grantId: string): Promise<RightsGrant> {
  const rows = await db.select().from(rightsGrants).where(eq(rightsGrants.id, grantId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Eser Onayı bulunamadı.");
  return row;
}

/** The approval that currently governs an article: pending or signed (§7.5). */
export async function findLiveApproval(articleId: string): Promise<RightsGrant | null> {
  const rows = await db
    .select()
    .from(rightsGrants)
    .where(
      and(
        eq(rightsGrants.articleId, articleId),
        inArray(rightsGrants.status, ["pending", "signed"]),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function findArticle(articleId: string): Promise<Article> {
  const rows = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Makale bulunamadı.");
  return row;
}

async function findWriter(userId: string): Promise<User> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Yazar bulunamadı.");
  return row;
}

/** Everything the approval screen needs for one writer (§7.2). */
export async function listApprovalsForWriter(actor: Actor) {
  return db
    .select({
      id: rightsGrants.id,
      status: rightsGrants.status,
      articleId: rightsGrants.articleId,
      articleTitle: articles.title,
      articleBody: articles.bodyMarkdown,
      bylineChoice: rightsGrants.bylineChoice,
      agreementVersion: agreementVersions.version,
      createdAt: rightsGrants.createdAt,
      signedAt: rightsGrants.signedAt,
      declinedAt: rightsGrants.declinedAt,
      declinedReason: rightsGrants.declinedReason,
      formTextHash: rightsGrants.formTextHash,
      formPdfMediaId: rightsGrants.formPdfMediaId,
    })
    .from(rightsGrants)
    .innerJoin(articles, eq(rightsGrants.articleId, articles.id))
    .leftJoin(agreementVersions, eq(rightsGrants.agreementVersionId, agreementVersions.id))
    .where(eq(rightsGrants.grantorId, actor.id))
    .orderBy(desc(rightsGrants.createdAt));
}

/** Editor view: which approvals are still waiting, and for how long (§9). */
export async function listPendingApprovals(actor: Actor) {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  return db
    .select({
      id: rightsGrants.id,
      articleId: rightsGrants.articleId,
      articleTitle: articles.title,
      grantorId: rightsGrants.grantorId,
      writerName: users.displayName,
      writerEmail: users.email,
      createdAt: rightsGrants.createdAt,
      reminderSentAt: rightsGrants.reminderSentAt,
      isOverdue: sql<boolean>`${rightsGrants.createdAt} < now() - interval '3 days'`,
    })
    .from(rightsGrants)
    .innerJoin(articles, eq(rightsGrants.articleId, articles.id))
    .innerJoin(users, eq(rightsGrants.grantorId, users.id))
    .where(eq(rightsGrants.status, "pending"))
    .orderBy(rightsGrants.createdAt);
}

/* ------------------------------------------------------------------ */
/* Approving and declining                                             */
/* ------------------------------------------------------------------ */

export const approvalSchema = z.strictObject({
  grantId: z.uuid(),
  /** The hash of the text the screen showed, re-derived server side (§7.3.1). */
  articleHash: z.string().length(64),
  bylineChoice: z.enum(["real_name", "pen_name"]),
  acknowledged: z.literal(true, { message: "Onay kutusunu işaretlemeniz gerekiyor." }),
});

export async function approveWork(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<RightsGrant> {
  const parsed = approvalSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Onay isteği geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const grant = await findGrant(parsed.data.grantId);
  if (!canSignRightsGrant(actor, grant)) {
    throw forbidden("Bu eseri yalnızca hak sahibi onaylayabilir.");
  }
  if (grant.status !== "pending") throw conflict("Bu Eser Onayı beklemede değil.");

  const article = await findArticle(grant.articleId);
  const writer = await findWriter(grant.grantorId);

  // §7.3.1: the text must not have moved under the writer's feet
  const currentHash = articleHash(article.bodyMarkdown);
  if (currentHash !== parsed.data.articleHash) {
    throw conflict("Eser metni onay sırasında değişti. Sayfayı yenileyip tekrar bakın.");
  }
  if (parsed.data.bylineChoice === "pen_name" && !writer.penName) {
    throw badRequest("Mahlasla yayın için önce profilinizde bir mahlas tanımlayın.");
  }

  const agreement = grant.agreementVersionId
    ? (
        await db
          .select()
          .from(agreementVersions)
          .where(eq(agreementVersions.id, grant.agreementVersionId))
          .limit(1)
      )[0]
    : null;

  const signedAt = new Date();
  const byline =
    parsed.data.bylineChoice === "pen_name" ? (writer.penName ?? writer.displayName) : writer.displayName;

  // §8: a one page record. The work's text is deliberately not in it.
  const pdf = await renderDocumentPdf({
    title: "postscript · Eser Onayı Kaydı",
    subtitle: article.title,
    sections: [
      {
        heading: "Onay",
        body: [
          `Dergi: postscript`,
          `Yazar: ${writer.displayName}`,
          `Yayın adı: ${byline} (${parsed.data.bylineChoice === "pen_name" ? "mahlas" : "gerçek ad"})`,
          `Eser: ${article.title}`,
          `Eser metni özeti (SHA-256): ${currentHash}`,
        ].join("\n"),
      },
      {
        heading: "Dayanak",
        body: [
          `Sözleşme sürümü: ${agreement?.version ?? "—"}`,
          `Sözleşme metin özeti (SHA-256): ${agreement?.bodyHash ?? "—"}`,
          "",
          APPROVAL_STATEMENT,
        ].join("\n"),
      },
      {
        heading: "Kayıt",
        body: [
          `Onay tarihi: ${formatContractDateTime(signedAt)}`,
          `IP adresi: ${meta.ip ?? "—"}`,
          `Tarayıcı: ${meta.userAgent ?? "—"}`,
        ].join("\n"),
      },
    ],
    footerNote: `Eser Onayı · ${currentHash.slice(0, 16)} · ${signedAt.toISOString()}`,
  });

  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "contracts",
    fileName: `eser-onayi-${article.slug}.pdf`,
    uploadedBy: writer.id,
  });

  const [signed] = await db
    .update(rightsGrants)
    .set({
      status: "signed",
      signedAt,
      signedIp: meta.ip,
      signedUserAgent: meta.userAgent,
      formTextHash: currentHash,
      bylineChoice: parsed.data.bylineChoice,
      formPdfMediaId: pdfMedia.id,
      updatedAt: signedAt,
    })
    .where(eq(rightsGrants.id, grant.id))
    .returning();

  const message = templates.rightsGrantSigned({
    displayName: writer.displayName,
    articleTitle: article.title,
  });
  await sendMail({
    to: writer.email,
    subject: message.subject,
    text: message.text,
    attachments: [
      { filename: `eser-onayi-${article.slug}.pdf`, content: pdf, contentType: "application/pdf" },
    ],
  });

  await writeAudit({
    actorId: actor.id,
    action: "work_approval.signed",
    entityType: "rights_grants",
    entityId: grant.id,
    after: {
      articleHash: currentHash,
      bylineChoice: parsed.data.bylineChoice,
      agreementVersionId: grant.agreementVersionId,
    },
    ip: meta.ip,
  });

  return signed!;
}

export const declineSchema = z.strictObject({
  grantId: z.uuid(),
  reason: z.string().trim().min(10, "Gerekçe en az 10 karakter olmalı.").max(1000),
});

/**
 * Declining sends the article back for revision. The status change itself is
 * the article service's job, so the state machine stays the only authority.
 */
export async function declineWork(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<RightsGrant> {
  const parsed = declineSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Ret isteği geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const grant = await findGrant(parsed.data.grantId);
  if (!canSignRightsGrant(actor, grant)) throw forbidden();
  if (grant.status !== "pending") throw conflict("Bu Eser Onayı beklemede değil.");

  const now = new Date();
  const [declined] = await db
    .update(rightsGrants)
    .set({ status: "declined", declinedAt: now, declinedReason: parsed.data.reason, updatedAt: now })
    .where(eq(rightsGrants.id, grant.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "work_approval.declined",
    entityType: "rights_grants",
    entityId: grant.id,
    after: { reason: parsed.data.reason },
    ip: meta.ip,
  });

  return declined!;
}

/* ------------------------------------------------------------------ */
/* Reminders (§12 of the base specification)                           */
/* ------------------------------------------------------------------ */

/**
 * Nudges writers whose approval has been waiting three days. Idempotent: a
 * reminder is not repeated within another three days.
 */
export async function sendApprovalReminders(now: Date = new Date()): Promise<number> {
  const threshold = new Date(now.getTime() - 3 * 86_400_000);

  const due = await db
    .select({
      grantId: rightsGrants.id,
      articleTitle: articles.title,
      email: users.email,
      displayName: users.displayName,
    })
    .from(rightsGrants)
    .innerJoin(articles, eq(rightsGrants.articleId, articles.id))
    .innerJoin(users, eq(rightsGrants.grantorId, users.id))
    .where(
      and(
        eq(rightsGrants.status, "pending"),
        lt(rightsGrants.createdAt, threshold),
        or(
          sql`${rightsGrants.reminderSentAt} is null`,
          lt(rightsGrants.reminderSentAt, threshold),
        ),
      ),
    );

  for (const row of due) {
    const message = templates.rightsGrantReminder({
      displayName: row.displayName,
      articleTitle: row.articleTitle,
      url: `${env().APP_URL}/writer/approvals`,
    });
    await sendMail({ to: row.email, subject: message.subject, text: message.text });

    await db
      .update(rightsGrants)
      .set({ reminderSentAt: now, updatedAt: now })
      .where(eq(rightsGrants.id, row.grantId));
  }

  return due.length;
}
