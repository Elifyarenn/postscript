/**
 * Framework agreement versions and their acceptance (§7.1).
 *
 * The point of this module is evidence. A published version can never be
 * edited; a new text means a new version. Every acceptance stores the hash of
 * the text that was actually on the writer's screen, together with the IP and
 * user agent, so it can be shown later exactly what was agreed to.
 */
import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  agreementAcceptances,
  agreementVersions,
  users,
  type AgreementVersion,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { sha256Hex } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { markdownToPlainText } from "@/lib/markdown";
import { renderDocumentPdf } from "@/lib/pdf";
import * as templates from "@emails/templates";
import { storeGeneratedPdf } from "./media";
import type { RequestMeta } from "./auth";

export const agreementDraftSchema = z.strictObject({
  title: z.string().trim().min(3).max(200),
  bodyMarkdown: z.string().trim().min(50, "Sözleşme metni çok kısa."),
});

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export async function getCurrentAgreement(): Promise<AgreementVersion | null> {
  const rows = await db
    .select()
    .from(agreementVersions)
    .where(and(eq(agreementVersions.isCurrent, true), isNull(agreementVersions.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAgreementVersions(actor: Actor) {
  if (!canManageAgreements(actor)) throw forbidden();
  return db
    .select()
    .from(agreementVersions)
    .where(isNull(agreementVersions.deletedAt))
    .orderBy(desc(agreementVersions.version));
}

/** Every version this user has ever accepted, newest first (§9.1). */
export async function listAcceptancesForUser(userId: string) {
  return db
    .select({
      acceptanceId: agreementAcceptances.id,
      acceptedAt: agreementAcceptances.acceptedAt,
      supersededAt: agreementAcceptances.supersededAt,
      bodyHashAtAcceptance: agreementAcceptances.bodyHashAtAcceptance,
      version: agreementVersions.version,
      title: agreementVersions.title,
      pdfMediaId: agreementVersions.pdfMediaId,
      isCurrent: agreementVersions.isCurrent,
    })
    .from(agreementAcceptances)
    .innerJoin(
      agreementVersions,
      eq(agreementAcceptances.agreementVersionId, agreementVersions.id),
    )
    .where(eq(agreementAcceptances.userId, userId))
    .orderBy(desc(agreementVersions.version));
}

/* ------------------------------------------------------------------ */
/* Drafting and publishing                                             */
/* ------------------------------------------------------------------ */

export async function createAgreementDraft(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<AgreementVersion> {
  if (!canManageAgreements(actor)) throw forbidden();

  const parsed = agreementDraftSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Sözleşme metni geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const latest = await db
    .select({ version: agreementVersions.version })
    .from(agreementVersions)
    .orderBy(desc(agreementVersions.version))
    .limit(1);

  const [draft] = await db
    .insert(agreementVersions)
    .values({
      version: (latest[0]?.version ?? 0) + 1,
      title: parsed.data.title,
      bodyMarkdown: parsed.data.bodyMarkdown,
      bodyHash: sha256Hex(parsed.data.bodyMarkdown),
      isCurrent: false,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "agreement.draft_created",
    entityType: "agreement_versions",
    entityId: draft!.id,
    after: { version: draft!.version, title: draft!.title },
    ip: meta.ip,
  });

  return draft!;
}

/** A draft may still be edited. Once published this throws. */
export async function updateAgreementDraft(
  actor: Actor,
  versionId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<AgreementVersion> {
  if (!canManageAgreements(actor)) throw forbidden();

  const parsed = agreementDraftSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Sözleşme metni geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const existing = await findVersion(versionId);
  if (existing.publishedAt) {
    throw conflict("Yayınlanmış sözleşme sürümü düzenlenemez. Yeni bir sürüm oluşturun.");
  }

  const [updated] = await db
    .update(agreementVersions)
    .set({
      title: parsed.data.title,
      bodyMarkdown: parsed.data.bodyMarkdown,
      bodyHash: sha256Hex(parsed.data.bodyMarkdown),
      updatedAt: new Date(),
    })
    .where(eq(agreementVersions.id, versionId))
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "agreement.draft_updated",
    entityType: "agreement_versions",
    entityId: versionId,
    ip: meta.ip,
  });

  return updated!;
}

async function findVersion(versionId: string): Promise<AgreementVersion> {
  const rows = await db
    .select()
    .from(agreementVersions)
    .where(eq(agreementVersions.id, versionId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Sözleşme sürümü bulunamadı.");
  return row;
}

/**
 * Publishing has consequences beyond this table: every earlier acceptance is
 * marked superseded and every active writer drops back to `pending_agreement`
 * until they accept the new text (§7.1).
 */
export async function publishAgreementVersion(
  actor: Actor,
  versionId: string,
  meta: RequestMeta,
): Promise<AgreementVersion> {
  if (!canManageAgreements(actor)) throw forbidden();

  const version = await findVersion(versionId);
  if (version.publishedAt) throw conflict("Bu sürüm zaten yayınlanmış.");

  const now = new Date();
  // Hash the body as it stands at publication; this is what acceptances compare against
  const bodyHash = sha256Hex(version.bodyMarkdown);

  const pdf = await renderDocumentPdf({
    title: version.title,
    subtitle: `Sürüm ${version.version} · Yayın tarihi ${now.toISOString().slice(0, 10)}`,
    sections: [{ body: markdownToPlainText(version.bodyMarkdown) }],
    footerNote: `postscript çerçeve sözleşme · sürüm ${version.version} · sha256: ${bodyHash}`,
  });

  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "agreements",
    fileName: `cerceve-sozlesme-v${version.version}.pdf`,
    uploadedBy: actor.id,
  });

  const published = await db.transaction(async (tx) => {
    // The partial unique index allows only one current row, so clear it first
    await tx
      .update(agreementVersions)
      .set({ isCurrent: false, updatedAt: now })
      .where(and(eq(agreementVersions.isCurrent, true), ne(agreementVersions.id, versionId)));

    const [row] = await tx
      .update(agreementVersions)
      .set({
        isCurrent: true,
        publishedAt: now,
        publishedBy: actor.id,
        bodyHash,
        pdfMediaId: pdfMedia.id,
        updatedAt: now,
      })
      .where(eq(agreementVersions.id, versionId))
      .returning();

    // Acceptances are never deleted; they are marked as belonging to an old text
    await tx
      .update(agreementAcceptances)
      .set({ supersededAt: now, updatedAt: now })
      .where(
        and(
          isNull(agreementAcceptances.supersededAt),
          ne(agreementAcceptances.agreementVersionId, versionId),
        ),
      );

    await tx
      .update(users)
      .set({ writerStatus: "pending_agreement", updatedAt: now })
      .where(and(eq(users.role, "writer"), eq(users.writerStatus, "active")));

    return row!;
  });

  // Tell the writers why their panel just locked
  const writers = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.role, "writer"), isNull(users.deletedAt)));

  const url = `${env().APP_URL}/writer/agreement`;
  for (const writer of writers) {
    const message = templates.newAgreementVersion({
      displayName: writer.displayName,
      version: published.version,
      url,
    });
    await sendMail({ to: writer.email, subject: message.subject, text: message.text });
  }

  await writeAudit({
    actorId: actor.id,
    action: "agreement.published",
    entityType: "agreement_versions",
    entityId: versionId,
    after: { version: published.version, bodyHash, notifiedWriters: writers.length },
    ip: meta.ip,
  });

  return published;
}

/* ------------------------------------------------------------------ */
/* Acceptance                                                          */
/* ------------------------------------------------------------------ */

export const acceptanceSchema = z.strictObject({
  agreementVersionId: z.uuid(),
  /** The hash of the text the browser rendered, echoed back for comparison. */
  bodyHash: z.string().length(64),
  acknowledged: z.literal(true, { message: "Onay kutusunu işaretlemeniz gerekiyor." }),
});

/**
 * Records an acceptance and reactivates the writer. Refuses when the hash the
 * browser echoes back does not match the stored text, which would mean the
 * writer agreed to something other than what is on file.
 */
export async function acceptAgreement(
  actor: Actor,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  const parsed = acceptanceSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Onay isteği geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const current = await getCurrentAgreement();
  if (!current) throw notFound("Yayınlanmış bir çerçeve sözleşme yok.");
  if (current.id !== parsed.data.agreementVersionId) {
    throw conflict("Sözleşmenin daha yeni bir sürümü var. Sayfayı yenileyin.");
  }
  if (current.bodyHash !== parsed.data.bodyHash) {
    throw conflict("Gösterilen metin ile kayıtlı metin eşleşmiyor. Sayfayı yenileyin.");
  }

  const already = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(
      and(
        eq(agreementAcceptances.userId, actor.id),
        eq(agreementAcceptances.agreementVersionId, current.id),
      ),
    )
    .limit(1);

  if (already.length === 0) {
    await db.insert(agreementAcceptances).values({
      userId: actor.id,
      agreementVersionId: current.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      bodyHashAtAcceptance: current.bodyHash,
    });
  }

  // Accepting the current agreement is what turns a writer active (§6)
  await db
    .update(users)
    .set({ writerStatus: "active", updatedAt: new Date() })
    .where(and(eq(users.id, actor.id), eq(users.role, "writer")));

  await writeAudit({
    actorId: actor.id,
    action: "agreement.accepted",
    entityType: "agreement_versions",
    entityId: current.id,
    after: { version: current.version, bodyHash: current.bodyHash },
    ip: meta.ip,
  });
}

/** Admin report: who has accepted the current version and who has not (§9.3). */
export async function acceptanceReport(actor: Actor) {
  if (!canManageAgreements(actor)) throw forbidden();

  const current = await getCurrentAgreement();
  if (!current) return { current: null, accepted: [], pending: [] };

  const writers = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      writerStatus: users.writerStatus,
    })
    .from(users)
    .where(and(eq(users.role, "writer"), isNull(users.deletedAt)));

  const acceptances = await db
    .select({ userId: agreementAcceptances.userId, acceptedAt: agreementAcceptances.acceptedAt })
    .from(agreementAcceptances)
    .where(eq(agreementAcceptances.agreementVersionId, current.id));

  const acceptedBy = new Map(acceptances.map((row) => [row.userId, row.acceptedAt]));

  return {
    current,
    accepted: writers
      .filter((writer) => acceptedBy.has(writer.id))
      .map((writer) => ({ ...writer, acceptedAt: acceptedBy.get(writer.id)! })),
    pending: writers.filter((writer) => !acceptedBy.has(writer.id)),
  };
}
