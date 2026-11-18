/**
 * Licence forms accepted electronically when a work is handed in (D-387).
 *
 * The author opens the form from the submit area, reads it to the end and
 * presses "Okudum, onaylıyorum"; only then can the work be sent. The form is
 * drawn twice: once to show it, once again on the submit from what is
 * actually sent. The submit goes through only if both drawings hash the same,
 * so the accepted text is provably the text of the work that arrived.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { licenceAcceptances, users, type Article, type LicenceAcceptance, type User } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { formatContractDateTime } from "@/lib/agreement/render";
import { ELECTRONIC_ILLUSTRATION_TEMPLATE_VERSION } from "@/lib/contributor-documents";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { renderMarkdown } from "@/lib/markdown";
import { renderDocumentPdf } from "@/lib/pdf";
import * as templates from "@emails/templates";
import { sendMail } from "./mail-queue";
import { storeGeneratedPdf } from "./media";
import { stripMarkdown } from "./agreements";
import { illustrationFormTitle, renderElectronicLicence, type ElectronicLicence, type ElectronicLicenceWork } from "./contributor-documents";
import type { RequestMeta } from "./auth";

/** What the submit form carries back: the form shown and the hash of its text. */
export const licenceAcceptanceSchema = z.strictObject({
  formId: z.uuid(),
  textHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type LicenceAcceptanceInput = z.infer<typeof licenceAcceptanceSchema>;

export type LicencePreview = {
  formId: string;
  textHash: string;
  html: string;
  /** For a drawing: the record id the upload must use, so section 1 names it. */
  illustrationId?: string;
};

export const LICENCE_MISSING_MESSAGE =
  "Ruhsat formunu okuyup onaylamadan gönderemezsiniz. Gönder düğmesinin üstündeki kutuyu işaretleyip formu sonuna kadar okuyun.";
const MISMATCH =
  "Onayladığınız ruhsat formu gönderilen eserle eşleşmiyor (metin ya da dosya formu açtıktan sonra değişmiş olabilir). Formu yeniden açıp onaylayın.";

async function findAuthor(userId: string): Promise<User> {
  const [row] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!row) throw notFound("Hesap bulunamadı.");
  return row;
}

async function toPreview(licence: ElectronicLicence, formId: string, extra: Partial<LicencePreview> = {}): Promise<LicencePreview> {
  return { formId, textHash: licence.textHash, html: await renderMarkdown(licence.markdown), ...extra };
}

/* ------------------------------------------------------------------ */
/* Showing the form                                                    */
/* ------------------------------------------------------------------ */

/**
 * The form for an article, from the title and text on the author's screen,
 * which the submit saves before it sends.
 */
export async function previewArticleLicence(
  actor: Actor,
  article: Pick<Article, "id" | "authorId" | "status">,
  onScreen: { title: string; bodyMarkdown: string },
): Promise<LicencePreview> {
  if (article.authorId !== actor.id) throw forbidden("Ruhsat formunu yalnızca eserin yazarı onaylayabilir.");
  if (article.status !== "draft" && article.status !== "revision_requested") {
    throw conflict("Bu yazı zaten gönderilmiş.");
  }
  const formId = randomUUID();
  const licence = await renderElectronicLicence(
    { kind: "article", articleId: article.id, title: onScreen.title.trim(), bodyMarkdown: onScreen.bodyMarkdown },
    await findAuthor(actor.id),
    formId,
    new Date(),
  );
  return toPreview(licence, formId);
}

const drawingPreviewSchema = z.strictObject({
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "Dosyanın özeti okunamadı."),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"], "Çizim JPEG, PNG ya da WEBP olmalı."),
  size: z.number().int().positive(),
});

/**
 * The form for a drawing not yet uploaded: the browser reads the file's hash,
 * type and size; the upload checks them against the file that arrives. The
 * drawing's record id is chosen here, since section 1 names it.
 */
export async function previewDrawingLicence(actor: Actor, raw: unknown): Promise<LicencePreview> {
  const parsed = drawingPreviewSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Dosya bilgileri okunamadı; dosyayı yeniden seçin.");
  const formId = randomUUID();
  const illustrationId = randomUUID();
  const licence = await renderElectronicLicence(
    { kind: "drawing", illustrationId, ...parsed.data },
    await findAuthor(actor.id),
    formId,
    new Date(),
  );
  return toPreview(licence, formId, { illustrationId });
}

/* ------------------------------------------------------------------ */
/* Checking and recording at the submit                                */
/* ------------------------------------------------------------------ */

/**
 * Draws the form again from what is being sent and compares it with the one
 * accepted. Returns the licence to record; throws 409 when nothing was
 * accepted, the form number was already used, or the texts differ.
 */
export async function verifyLicenceAcceptance(
  actor: Actor,
  raw: unknown,
  work: ElectronicLicenceWork,
  now: Date = new Date(),
): Promise<{ formId: string; licence: ElectronicLicence }> {
  if (raw == null) throw conflict(LICENCE_MISSING_MESSAGE);
  const parsed = licenceAcceptanceSchema.safeParse(raw);
  if (!parsed.success) throw conflict(LICENCE_MISSING_MESSAGE);

  const [used] = await db
    .select({ id: licenceAcceptances.id })
    .from(licenceAcceptances)
    .where(eq(licenceAcceptances.id, parsed.data.formId))
    .limit(1);
  if (used) throw conflict(MISMATCH);

  const licence = await renderElectronicLicence(work, await findAuthor(actor.id), parsed.data.formId, now);
  if (licence.textHash !== parsed.data.textHash) throw conflict(MISMATCH);
  return { formId: parsed.data.formId, licence };
}

/**
 * Records an accepted form: the PDF copy first, then the row, which is never
 * changed afterwards, then the author's mail with the PDF attached.
 */
export async function recordLicenceAcceptance(
  actor: Actor,
  accepted: { formId: string; licence: ElectronicLicence },
  work: { articleId: string; title: string } | { illustrationId: string },
  meta: RequestMeta,
): Promise<LicenceAcceptance> {
  const author = await findAuthor(actor.id);
  const acceptedAt = new Date();
  const { formId, licence } = accepted;
  const workTitle = "title" in work ? work.title : illustrationFormTitle(work.illustrationId);

  const pdf = await renderDocumentPdf({
    title: "postscript Eser Bazlı Kullanım Ruhsatı Formu",
    subtitle: workTitle,
    sections: [
      { body: stripMarkdown(licence.markdown) },
      { heading: "Elektronik onay kaydı", body: approvalLines(author, { acceptedAt, ip: meta.ip, userAgent: meta.userAgent }) },
    ],
    footerNote: `Form no ${formId} — metin özeti (SHA-256) ${licence.textHash.slice(0, 16)}…`,
  });
  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "contracts",
    fileName: `eser-ruhsati-${formId.slice(0, 8)}.pdf`,
    uploadedBy: author.id,
  });

  const [row] = await db
    .insert(licenceAcceptances)
    .values({
      id: formId,
      userId: author.id,
      articleId: "articleId" in work ? work.articleId : null,
      illustrationId: "illustrationId" in work ? work.illustrationId : null,
      workTitle,
      templateVersion: licence.templateVersion,
      renderedMarkdown: licence.markdown,
      textHash: licence.textHash,
      contentHash: licence.contentHash,
      acceptedAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
      pdfMediaId: pdfMedia.id,
    })
    .returning();

  await writeAudit({
    actorId: author.id,
    action: "licence.accepted_electronically",
    entityType: "licence_acceptances",
    entityId: formId,
    after: {
      articleId: row!.articleId,
      illustrationId: row!.illustrationId,
      templateVersion: licence.templateVersion,
      textHash: licence.textHash,
      contentHash: licence.contentHash,
    },
    ip: meta.ip,
  });

  const message = templates.licenceAccepted({
    displayName: author.displayName,
    workTitle,
    formId,
    url: `${env().APP_URL}${"illustrationId" in work ? "/cizer" : "/writer/agreement"}`,
  });
  await sendMail({
    to: author.email,
    ...message,
    attachments: [{ filename: `eser-ruhsati-${formId.slice(0, 8)}.pdf`, content: pdf, contentType: "application/pdf" }],
  });

  return row!;
}

function approvalLines(author: User, record: { acceptedAt: Date; ip: string | null; userAgent: string | null }): string {
  return [
    `Onaylayan: ${author.displayName} (Panel hesabı ${author.id})`,
    `Onay tarihi ve saati: ${formatContractDateTime(record.acceptedAt)}`,
    `IP adresi: ${record.ip ?? "—"}`,
    `Tarayıcı: ${record.userAgent ?? "—"}`,
    "Onay yöntemi: Panel'de formun sonuna kadar görüntülenmesi, \"Okudum, onaylıyorum\" ve eserin gönderilmesi (Madde 12.1)",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

export type LicenceAcceptanceItem = {
  id: string;
  workTitle: string;
  kind: "article" | "drawing";
  templateVersion: string;
  acceptedAt: Date;
  textHash: string;
  personName: string;
  userId: string;
};

function acceptanceList() {
  return db
    .select({
      id: licenceAcceptances.id,
      workTitle: licenceAcceptances.workTitle,
      templateVersion: licenceAcceptances.templateVersion,
      acceptedAt: licenceAcceptances.acceptedAt,
      textHash: licenceAcceptances.textHash,
      personName: users.displayName,
      userId: licenceAcceptances.userId,
    })
    .from(licenceAcceptances)
    .innerJoin(users, eq(users.id, licenceAcceptances.userId))
    .orderBy(desc(licenceAcceptances.acceptedAt));
}

function toItem(row: Awaited<ReturnType<typeof acceptanceList>>[number]): LicenceAcceptanceItem {
  // The template says which kind it was, even after a removed drawing's row is gone
  return { ...row, kind: row.templateVersion === ELECTRONIC_ILLUSTRATION_TEMPLATE_VERSION ? "drawing" : "article" };
}

export async function listOwnLicenceAcceptances(actor: Actor): Promise<LicenceAcceptanceItem[]> {
  return (await acceptanceList().where(eq(licenceAcceptances.userId, actor.id))).map(toItem);
}

export async function listLicenceAcceptances(actor: Actor, limit = 200): Promise<LicenceAcceptanceItem[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  return (await acceptanceList().limit(limit)).map(toItem);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The accepted form's PDF, drawn again from the stored row: the owner or an agreements admin only. */
export async function licenceAcceptancePdf(actor: Actor, id: string): Promise<{ fileName: string; body: Buffer }> {
  if (!UUID.test(id)) throw notFound("Belge bulunamadı.");
  const [row] = await db.select().from(licenceAcceptances).where(eq(licenceAcceptances.id, id)).limit(1);
  if (!row || (row.userId !== actor.id && !canManageAgreements(actor))) throw notFound("Belge bulunamadı.");
  const [author] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  const body = await renderDocumentPdf({
    title: "postscript Eser Bazlı Kullanım Ruhsatı Formu",
    subtitle: row.workTitle,
    sections: [
      { body: stripMarkdown(row.renderedMarkdown) },
      { heading: "Elektronik onay kaydı", body: approvalLines(author!, row) },
    ],
    footerNote: `Form no ${row.id} — metin özeti (SHA-256) ${row.textHash.slice(0, 16)}…`,
  });
  return { fileName: `eser-ruhsati-${row.id.slice(0, 8)}.pdf`, body };
}
