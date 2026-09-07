/**
 * Contract versions, rendering and acceptance (§4, §5, §6).
 *
 * The contract text is a file in the repository. A version is a snapshot of
 * that file: `body_markdown` holds the raw template and `body_hash` its
 * SHA-256, so a later edit to the file cannot alter what someone already
 * signed. What the writer sees is that template filled with their own details,
 * and it is the hash of the *filled* text that the acceptance records.
 */
import "server-only";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  agreementAcceptances,
  agreementVersions,
  kvkkVersions,
  users,
  type AgreementVersion,
  type User,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { renderDocumentPdf } from "@/lib/pdf";
import {
  AgreementRenderError,
  renderAgreement,
  unknownPlaceholders,
  type AgreementContext,
} from "@/lib/agreement/render";
import { hashDocument } from "@/lib/agreement/normalise";
import { readAgreementTemplate } from "@/lib/agreement/template";
import * as templates from "@emails/templates";
import { storeGeneratedPdf } from "./media";
import { getSiteSettings } from "./site-settings";
import type { RequestMeta } from "./auth";

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
      pdfMediaId: agreementAcceptances.pdfMediaId,
      version: agreementVersions.version,
      title: agreementVersions.title,
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
/* Building the render context                                         */
/* ------------------------------------------------------------------ */

async function currentKvkkVersion(): Promise<number | null> {
  const rows = await db
    .select({ version: kvkkVersions.version })
    .from(kvkkVersions)
    .where(eq(kvkkVersions.isCurrent, true))
    .limit(1);
  return rows[0]?.version ?? null;
}

/**
 * Gathers everything the template needs for one writer. Pure data assembly:
 * the render itself stays deterministic and testable.
 */
export async function buildAgreementContext(
  version: AgreementVersion,
  writer: Pick<User, "displayName" | "birthDate" | "email" | "penName">,
  acceptance: { acceptedAt: Date | null; ip: string | null } | null = null,
): Promise<AgreementContext> {
  const publisher = await getSiteSettings();

  return {
    agreement: {
      version: version.version,
      publishedAt: version.publishedAt,
      bodyHash: version.bodyHash,
    },
    publisher: {
      partner1: publisher.publisher_partner_1,
      partner2: publisher.publisher_partner_2,
      address: publisher.publisher_address,
      email: publisher.publisher_email,
      domain: publisher.public_domain,
      jurisdictionCity: publisher.jurisdiction_city,
    },
    writer: {
      displayName: writer.displayName,
      birthDate: writer.birthDate,
      email: writer.email,
      penName: writer.penName,
    },
    kvkkVersion: await currentKvkkVersion(),
    acceptance,
  };
}

export type AgreementPreview = { markdown: string; hash: string; version: AgreementVersion };

/**
 * The contract as one writer would see it right now. Throws
 * `AgreementRenderError` when anything is missing, which is exactly what the
 * promotion check relies on (§6.1 rule 6).
 */
export async function renderAgreementForWriter(
  writer: Pick<User, "displayName" | "birthDate" | "email" | "penName">,
  acceptance: { acceptedAt: Date | null; ip: string | null } | null = null,
): Promise<AgreementPreview> {
  const version = await getCurrentAgreement();
  if (!version) {
    throw new AgreementRenderError("Yayınlanmış bir sözleşme sürümü yok.", ["agreement.version"]);
  }

  const context = await buildAgreementContext(version, writer, acceptance);
  const rendered = renderAgreement(version.bodyMarkdown, context);

  return { ...rendered, version };
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Creates a draft from the template file. The admin does not type contract
 * text: §11 makes the file the single source, and every change to it is a new
 * version rather than an edit to an existing one.
 */
export async function createVersionFromTemplate(
  actor: Actor,
  meta: RequestMeta,
): Promise<AgreementVersion> {
  if (!canManageAgreements(actor)) throw forbidden();

  const template = readAgreementTemplate();

  // §9: a version cannot be published while the template uses a placeholder the
  // dictionary cannot fill, so it is refused at the door
  const sample = await buildAgreementContext(
    { version: 1, publishedAt: new Date(), bodyHash: "0".repeat(64) } as AgreementVersion,
    { displayName: "x", birthDate: "2000-01-01", email: "x@example.com", penName: null },
  );
  const unknown = unknownPlaceholders(template, sample);
  if (unknown.length > 0) {
    throw badRequest(`Şablonda sözlük dışı yer tutucu var: ${unknown.join(", ")}`);
  }

  const bodyHash = hashDocument(template);

  const existing = await db
    .select({ id: agreementVersions.id, version: agreementVersions.version })
    .from(agreementVersions)
    .where(eq(agreementVersions.bodyHash, bodyHash))
    .limit(1);
  if (existing[0]) {
    throw conflict(`Bu şablon metni zaten ${existing[0].version}. sürüm olarak kayıtlı.`);
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
      title: "postscript Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü",
      bodyMarkdown: template,
      bodyHash,
      isCurrent: false,
    })
    .returning();

  await writeAudit({
    actorId: actor.id,
    action: "agreement.draft_created",
    entityType: "agreement_versions",
    entityId: draft!.id,
    after: { version: draft!.version, bodyHash },
    ip: meta.ip,
  });

  return draft!;
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
 * until they accept the new text (§7.1 of the base specification).
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

  const published = await db.transaction(async (tx) => {
    // The partial unique index allows only one current row, so clear it first
    await tx
      .update(agreementVersions)
      .set({ isCurrent: false, updatedAt: now })
      .where(and(eq(agreementVersions.isCurrent, true), ne(agreementVersions.id, versionId)));

    const [row] = await tx
      .update(agreementVersions)
      .set({ isCurrent: true, publishedAt: now, publishedBy: actor.id, updatedAt: now })
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
    after: { version: published.version, bodyHash: published.bodyHash, notified: writers.length },
    ip: meta.ip,
  });

  return published;
}

/* ------------------------------------------------------------------ */
/* Acceptance (§6.3)                                                   */
/* ------------------------------------------------------------------ */

export const acceptanceSchema = z.strictObject({
  agreementVersionId: z.uuid(),
  /** Hash of the filled text the browser displayed, re-derived server side. */
  renderedHash: z.string().length(64),
  acknowledged: z.literal(true, { message: "Onay kutusunu işaretlemeniz gerekiyor." }),
});

/**
 * Records an acceptance and reactivates the writer, all or nothing.
 *
 * The hash the browser echoes is never trusted: the server renders the contract
 * again and compares. If the two disagree, the writer was looking at something
 * other than what is on file, and the acceptance is refused (§5.2).
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

  const rows = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  const writer = rows[0];
  if (!writer) throw notFound("Kullanıcı bulunamadı.");

  const current = await getCurrentAgreement();
  if (!current) throw notFound("Yayınlanmış bir çerçeve sözleşme yok.");
  if (current.id !== parsed.data.agreementVersionId) {
    throw conflict("Sözleşmenin daha yeni bir sürümü var. Sayfayı yenileyin.");
  }

  // 1. Re-render and verify the hash against what was on screen
  const preview = await renderAgreementForWriter(writer);
  if (preview.hash !== parsed.data.renderedHash) {
    throw conflict("Gösterilen metin ile kayıtlı metin eşleşmiyor. Sayfayı yenileyin.");
  }

  const acceptedAt = new Date();

  // 2. Stamp the acceptance into the text: this is the final document
  const final = await renderAgreementForWriter(writer, { acceptedAt, ip: meta.ip });

  // 4. The readable copy. Generated before the transaction so a slow PDF does
  // not hold a write lock; the record below is what actually proves anything.
  const pdf = await renderDocumentPdf({
    title: "postscript Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü",
    subtitle: `Sürüm ${current.version} · ${writer.displayName}`,
    sections: [{ body: stripMarkdown(final.markdown) }],
    footerNote: `Sürüm ${current.version} — ${preview.hash.slice(0, 16)} — ${acceptedAt.toISOString()}`,
  });

  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "contracts",
    fileName: `sozlesme-v${current.version}-${writer.id}.pdf`,
    uploadedBy: writer.id,
  });

  await db.transaction(async (tx) => {
    // 3. The acceptance record
    await tx
      .insert(agreementAcceptances)
      .values({
        userId: writer.id,
        agreementVersionId: current.id,
        acceptedAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
        bodyHashAtAcceptance: preview.hash,
        renderedMarkdown: final.markdown,
        pdfMediaId: pdfMedia.id,
      })
      .onConflictDoNothing();

    // 5. Accepting the current contract is what turns a writer active
    await tx
      .update(users)
      .set({ writerStatus: "active", updatedAt: acceptedAt })
      .where(and(eq(users.id, writer.id), eq(users.role, "writer")));
  });

  // 6. and 7.
  await writeAudit({
    actorId: writer.id,
    action: "agreement.accepted",
    entityType: "agreement_versions",
    entityId: current.id,
    after: { version: current.version, bodyHashAtAcceptance: preview.hash },
    ip: meta.ip,
  });

  const message = templates.agreementAccepted({
    displayName: writer.displayName,
    version: current.version,
  });
  await sendMail({
    to: writer.email,
    subject: message.subject,
    text: message.text,
    attachments: [
      {
        filename: `postscript-sozlesme-v${current.version}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });
}

/**
 * Markdown to plain text for the PDF. The evidence is `rendered_markdown`; the
 * PDF only has to be readable, so tables become simple lines.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^\s*\|\s*-+[-\s|:]*\|\s*$/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Admin report: who has accepted the current version and who has not (§9). */
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
