/**
 * Per-work rights grant forms (§7.2).
 *
 * FSEK art. 52 requires each economic right to be named individually, so the
 * form text lists them one per line and the hash of that exact text is stored
 * with the signature. After signing, the form is frozen: a change means
 * revoking it and issuing a new one.
 */
import "server-only";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { articles, rightsGrants, users, type Article, type RightsGrant, type User } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessEditorPanel, canSignRightsGrant, type Actor } from "@/lib/auth/rbac";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { renderDocumentPdf } from "@/lib/pdf";
import * as templates from "@emails/templates";
import { storeGeneratedPdf } from "./media";
import { getRightsTemplate, type RightsTemplate } from "./settings";
import type { RequestMeta } from "./auth";

/* ------------------------------------------------------------------ */
/* Form text                                                           */
/* ------------------------------------------------------------------ */

const RIGHT_LABELS = {
  rightAdaptation: "İşleme hakkı (FSEK m.21)",
  rightReproduction: "Çoğaltma hakkı (FSEK m.22)",
  rightDistribution: "Yayma hakkı (FSEK m.23)",
  rightCommunicationToPublic: "Umuma iletim hakkı (FSEK m.25)",
} as const;

const GRANT_TYPE_LABELS = {
  assignment: "Devir (mali hakların tamamen devri)",
  exclusive_license: "Tam ruhsat (inhisari lisans)",
  non_exclusive_license: "Basit ruhsat (inhisari olmayan lisans)",
} as const;

const CHANNEL_LABELS: Record<string, string> = {
  web: "İnternet sitesi",
  pdf_issue: "PDF sayı",
  social: "Sosyal medya",
  newsletter: "Bülten",
  future_channels: "İleride kullanılacak mecralar",
};

export type GrantFields = Pick<
  RightsGrant,
  | "grantType"
  | "rightAdaptation"
  | "rightReproduction"
  | "rightDistribution"
  | "rightCommunicationToPublic"
  | "channels"
  | "exclusivityMonths"
  | "territory"
  | "commercialUseIncluded"
>;

/**
 * The full, human readable form. This exact string is what the writer sees and
 * what gets hashed into `form_text_hash`, so any change to it changes the hash.
 */
export function renderGrantFormText(input: {
  fields: GrantFields;
  articleTitle: string;
  writerName: string;
}): string {
  const { fields } = input;

  const grantedRights = (Object.keys(RIGHT_LABELS) as (keyof typeof RIGHT_LABELS)[])
    .filter((key) => fields[key])
    .map((key) => `  - ${RIGHT_LABELS[key]}`);

  const withheldRights = (Object.keys(RIGHT_LABELS) as (keyof typeof RIGHT_LABELS)[])
    .filter((key) => !fields[key])
    .map((key) => `  - ${RIGHT_LABELS[key]}`);

  const channels = fields.channels.map((channel) => `  - ${CHANNEL_LABELS[channel] ?? channel}`);

  const lines = [
    "ESER BAZLI MALİ HAK DEVRİ / RUHSAT FORMU",
    "",
    `Eser: ${input.articleTitle}`,
    `Hak sahibi: ${input.writerName}`,
    `Devralan: postscript e-dergi`,
    "",
    `Sözleşme türü: ${GRANT_TYPE_LABELS[fields.grantType]}`,
    "",
    "Devredilen / lisanslanan haklar:",
    ...(grantedRights.length > 0 ? grantedRights : ["  - (yok)"]),
    "",
    "Devredilmeyen haklar (hak sahibinde kalır):",
    ...(withheldRights.length > 0 ? withheldRights : ["  - (yok)"]),
    "",
    "Kullanım mecraları:",
    ...(channels.length > 0 ? channels : ["  - (yok)"]),
    "",
    `Süre: ${
      fields.exclusivityMonths === null || fields.exclusivityMonths === 0
        ? "Süresiz"
        : `${fields.exclusivityMonths} ay`
    }`,
    `Ülke / bölge: ${fields.territory}`,
    `Ticari kullanım: ${fields.commercialUseIncluded ? "Dahil" : "Dahil değil"}`,
    "Bedel: Yok",
    "",
    "Manevi haklar FSEK m.14-17 uyarınca eser sahibinde kalır ve devredilemez.",
    "Bu form, imzalandığı anda geçerli olan çerçeve sözleşmenin eki niteliğindedir.",
  ];

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Creating the form                                                   */
/* ------------------------------------------------------------------ */

export const grantFieldsSchema = z.strictObject({
  grantType: z.enum(["assignment", "exclusive_license", "non_exclusive_license"]),
  rightAdaptation: z.boolean(),
  rightReproduction: z.boolean(),
  rightDistribution: z.boolean(),
  rightCommunicationToPublic: z.boolean(),
  channels: z.array(z.enum(["web", "pdf_issue", "social", "newsletter", "future_channels"])),
  exclusivityMonths: z.number().int().min(0).max(600).nullable(),
  territory: z.string().trim().min(2).max(80),
  commercialUseIncluded: z.boolean(),
});

function fieldsFromTemplate(template: RightsTemplate): GrantFields {
  return {
    grantType: template.grantType,
    rightAdaptation: template.rightAdaptation,
    rightReproduction: template.rightReproduction,
    rightDistribution: template.rightDistribution,
    rightCommunicationToPublic: template.rightCommunicationToPublic,
    channels: template.channels,
    exclusivityMonths: template.exclusivityMonths,
    territory: template.territory,
    commercialUseIncluded: template.commercialUseIncluded,
  };
}

/**
 * Called automatically when an editor accepts an article (§7.2). Returns the
 * existing active form if one is already open, so accepting twice is harmless.
 */
export async function createGrantForArticle(
  article: Article,
  options: { overrides?: Partial<GrantFields>; actorId: string | null; ip?: string | null } = {
    actorId: null,
  },
): Promise<RightsGrant> {
  if (!article.authorId) {
    throw badRequest("Makaleye yazar atanmadan hak devri formu oluşturulamaz.");
  }

  const active = await findActiveGrant(article.id);
  if (active) return active;

  const template = await getRightsTemplate();
  const fields: GrantFields = { ...fieldsFromTemplate(template), ...options.overrides };

  const writer = await findWriter(article.authorId);
  const formText = renderGrantFormText({
    fields,
    articleTitle: article.title,
    writerName: writer.penName ?? writer.displayName,
  });

  const [grant] = await db
    .insert(rightsGrants)
    .values({
      articleId: article.id,
      grantorId: article.authorId,
      ...fields,
      formTextHash: sha256Hex(formText),
      status: "pending",
    })
    .returning();

  const url = `${env().APP_URL}/writer/rights/${grant!.id}`;
  const message = templates.rightsGrantPending({
    displayName: writer.displayName,
    articleTitle: article.title,
    url,
  });
  await sendMail({ to: writer.email, subject: message.subject, text: message.text });

  await writeAudit({
    actorId: options.actorId,
    action: "rights_grant.created",
    entityType: "rights_grants",
    entityId: grant!.id,
    after: { articleId: article.id, grantorId: article.authorId, ...fields },
    ip: options.ip ?? null,
  });

  return grant!;
}

/** An editor adjusting the defaults for one article before the writer signs. */
export async function updateGrantFields(
  actor: Actor,
  grantId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<RightsGrant> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const parsed = grantFieldsSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Form alanları geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const grant = await findGrant(grantId);
  if (grant.status !== "pending") {
    throw conflict("Yalnızca imza bekleyen form düzenlenebilir. Formu iptal edip yenisini açın.");
  }

  const article = await findArticle(grant.articleId);
  const writer = await findWriter(grant.grantorId);
  const formText = renderGrantFormText({
    fields: parsed.data,
    articleTitle: article.title,
    writerName: writer.penName ?? writer.displayName,
  });

  const [updated] = await db
    .update(rightsGrants)
    .set({ ...parsed.data, formTextHash: sha256Hex(formText), updatedAt: new Date() })
    .where(eq(rightsGrants.id, grantId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "rights_grant.fields_updated",
    entityType: "rights_grants",
    entityId: grantId,
    before: {
      grantType: grant.grantType,
      channels: grant.channels,
      exclusivityMonths: grant.exclusivityMonths,
    },
    after: parsed.data,
    ip: meta.ip,
  });

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export async function findGrant(grantId: string): Promise<RightsGrant> {
  const rows = await db.select().from(rightsGrants).where(eq(rightsGrants.id, grantId)).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Devir formu bulunamadı.");
  return row;
}

/** The one form that currently governs an article; revoked forms are history. */
export async function findActiveGrant(articleId: string): Promise<RightsGrant | null> {
  const rows = await db
    .select()
    .from(rightsGrants)
    .where(and(eq(rightsGrants.articleId, articleId), isNull(rightsGrants.revokedAt)))
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

/** The writer's own forms, split into the three tabs of §9.1. */
export async function listGrantsForWriter(actor: Actor) {
  return db
    .select({
      id: rightsGrants.id,
      status: rightsGrants.status,
      articleId: rightsGrants.articleId,
      articleTitle: articles.title,
      createdAt: rightsGrants.createdAt,
      signedAt: rightsGrants.signedAt,
      declinedAt: rightsGrants.declinedAt,
      declinedReason: rightsGrants.declinedReason,
      formPdfMediaId: rightsGrants.formPdfMediaId,
    })
    .from(rightsGrants)
    .innerJoin(articles, eq(rightsGrants.articleId, articles.id))
    .where(and(eq(rightsGrants.grantorId, actor.id), isNull(rightsGrants.revokedAt)))
    .orderBy(desc(rightsGrants.createdAt));
}

/** Editor view: which forms are still waiting (§9.2). */
export async function listPendingGrants(actor: Actor) {
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
    })
    .from(rightsGrants)
    .innerJoin(articles, eq(rightsGrants.articleId, articles.id))
    .innerJoin(users, eq(rightsGrants.grantorId, users.id))
    .where(and(eq(rightsGrants.status, "pending"), isNull(rightsGrants.revokedAt)))
    .orderBy(rightsGrants.createdAt);
}

/**
 * Reads the form as the writer must see it: the stored fields turned back into
 * the exact text whose hash was recorded.
 */
export async function renderGrantForWriter(actor: Actor, grantId: string) {
  const grant = await findGrant(grantId);
  if (!canSignRightsGrant(actor, grant) && !canAccessEditorPanel(actor)) throw forbidden();

  const article = await findArticle(grant.articleId);
  const writer = await findWriter(grant.grantorId);

  const formText = renderGrantFormText({
    fields: grant,
    articleTitle: article.title,
    writerName: writer.penName ?? writer.displayName,
  });

  return { grant, article, writer, formText, formTextHash: sha256Hex(formText) };
}

/* ------------------------------------------------------------------ */
/* Signing, declining, revoking                                        */
/* ------------------------------------------------------------------ */

export const signatureSchema = z.strictObject({
  grantId: z.uuid(),
  /** Hash of the text the browser rendered, so the two are proven identical. */
  formTextHash: z.string().length(64),
  acknowledged: z.literal(true, { message: "Onay kutusunu işaretlemeniz gerekiyor." }),
});

export async function signRightsGrant(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<RightsGrant> {
  const parsed = signatureSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("İmza isteği geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const grant = await findGrant(parsed.data.grantId);
  if (!canSignRightsGrant(actor, grant)) throw forbidden("Bu formu yalnızca hak sahibi imzalayabilir.");
  if (grant.status !== "pending") throw conflict("Bu form imza bekleyen durumda değil.");
  if (grant.revokedAt) throw conflict("Bu form iptal edilmiş.");

  const article = await findArticle(grant.articleId);
  const writer = await findWriter(grant.grantorId);
  const formText = renderGrantFormText({
    fields: grant,
    articleTitle: article.title,
    writerName: writer.penName ?? writer.displayName,
  });
  const formTextHash = sha256Hex(formText);

  // The writer must be signing exactly the text that is on file
  if (formTextHash !== parsed.data.formTextHash || formTextHash !== grant.formTextHash) {
    throw conflict("Form içeriği değişmiş görünüyor. Sayfayı yenileyip tekrar deneyin.");
  }

  const signedAt = new Date();

  const pdf = await renderDocumentPdf({
    title: "Eser Bazlı Mali Hak Devri Formu",
    subtitle: `${article.title} · ${writer.penName ?? writer.displayName}`,
    sections: [
      { body: formText },
      {
        heading: "İmza kaydı",
        body: [
          `İmza tarihi: ${signedAt.toISOString()}`,
          `IP adresi: ${meta.ip ?? "-"}`,
          `Tarayıcı: ${meta.userAgent ?? "-"}`,
        ].join("\n"),
      },
    ],
    footerNote: `postscript hak devri formu · sha256: ${formTextHash}`,
  });

  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "rights-grants",
    fileName: `hak-devri-${article.slug}.pdf`,
    uploadedBy: writer.id,
  });

  const [signed] = await db
    .update(rightsGrants)
    .set({
      status: "signed",
      signedAt,
      signedIp: meta.ip,
      signedUserAgent: meta.userAgent,
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
      { filename: `hak-devri-${article.slug}.pdf`, content: pdf, contentType: "application/pdf" },
    ],
  });

  await writeAudit({
    actorId: actor.id,
    action: "rights_grant.signed",
    entityType: "rights_grants",
    entityId: grant.id,
    after: { formTextHash, signedAt: signedAt.toISOString() },
    ip: meta.ip,
  });

  return signed!;
}

export const declineSchema = z.strictObject({
  grantId: z.uuid(),
  reason: z.string().trim().min(5, "Gerekçe en az 5 karakter olmalı.").max(1000),
});

/**
 * Declining sends the article back for revision. The status change itself is
 * done by the article service so the state machine stays the only authority.
 */
export async function declineRightsGrant(
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
  if (grant.status !== "pending") throw conflict("Bu form imza bekleyen durumda değil.");

  const now = new Date();
  const [declined] = await db
    .update(rightsGrants)
    .set({
      status: "declined",
      declinedAt: now,
      declinedReason: parsed.data.reason,
      updatedAt: now,
    })
    .where(eq(rightsGrants.id, grant.id))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "rights_grant.declined",
    entityType: "rights_grants",
    entityId: grant.id,
    after: { reason: parsed.data.reason },
    ip: meta.ip,
  });

  return declined!;
}

/**
 * A signed form cannot be edited (§7.2). Changing the terms means revoking the
 * old form, which stays on file, and opening a new pending one.
 */
export async function revokeAndReissue(
  actor: Actor,
  grantId: string,
  overrides: Partial<GrantFields>,
  meta: RequestMeta,
): Promise<RightsGrant> {
  if (!canAccessEditorPanel(actor)) throw forbidden();

  const grant = await findGrant(grantId);
  if (grant.revokedAt) throw conflict("Bu form zaten iptal edilmiş.");

  const now = new Date();
  await db
    .update(rightsGrants)
    .set({ status: "revoked", revokedAt: now, revokedBy: actor.id, updatedAt: now })
    .where(eq(rightsGrants.id, grantId));

  await writeAudit({
    actorId: actor.id,
    action: "rights_grant.revoked",
    entityType: "rights_grants",
    entityId: grantId,
    before: { status: grant.status },
    ip: meta.ip,
  });

  const article = await findArticle(grant.articleId);
  return createGrantForArticle(article, { overrides, actorId: actor.id, ip: meta.ip });
}

/* ------------------------------------------------------------------ */
/* Reminders (§12)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Nudges writers whose form has been waiting for three days. Idempotent: a
 * reminder is not repeated within another three days.
 */
export async function sendGrantReminders(now: Date = new Date()): Promise<number> {
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
        isNull(rightsGrants.revokedAt),
        lt(rightsGrants.createdAt, threshold),
        or(isNull(rightsGrants.reminderSentAt), lt(rightsGrants.reminderSentAt, threshold)),
      ),
    );

  for (const row of due) {
    const message = templates.rightsGrantReminder({
      displayName: row.displayName,
      articleTitle: row.articleTitle,
      url: `${env().APP_URL}/writer/rights/${row.grantId}`,
    });
    await sendMail({ to: row.email, subject: message.subject, text: message.text });

    await db
      .update(rightsGrants)
      .set({ reminderSentAt: now, updatedAt: now })
      .where(eq(rightsGrants.id, row.grantId));
  }

  return due.length;
}
