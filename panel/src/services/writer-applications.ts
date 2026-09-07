/**
 * Writer application pipeline (§6 of the writer-application module).
 *
 * The flow is strictly staged and one-directional:
 *
 *   1. A plain reader applies, attaching a sample work file.
 *   2. An editor decides first (approve → pass to admin, or reject).
 *   3. The admin decides second; approving defines the contract the
 *      applicant must sign — the current agreement version.
 *   4. The applicant signs that contract; only the signature turns the
 *      account into an active writer.
 *
 * Everything a rule depends on is re-checked here on the server: the
 * prerequisites of §6, the 30 day cooldown, the role of the caller, and the
 * legality of the state transition. No button state in the browser is trusted.
 */
import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  agreementAcceptances,
  media,
  users,
  writerApplications,
  type Role,
  type WriterApplication,
  type WriterApplicationStatus,
} from "@/db/schema";
import { writeAudit, recordRoleChange } from "@/lib/audit";
import {
  canFinalizeApplications,
  canReviewApplications,
  canSubmitApplication,
  type Actor,
} from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { badRequest, conflict, forbidden, isAppError, notFound, rateLimited } from "@/lib/errors";
import { sendMail } from "@/lib/mail/transport";
import { buildStorageKey, getStorage } from "@/lib/storage";
import { renderDocumentPdf } from "@/lib/pdf";
import { renderAgreementForWriter, getCurrentAgreement, stripMarkdown } from "./agreements";
import { storeGeneratedPdf } from "./media";
import { checkWriterEligibility, findUserById } from "./users";
import type { RequestMeta } from "./auth";
import * as templates from "@emails/templates";

/* ------------------------------------------------------------------ */
/* Application file validation                                         */
/* ------------------------------------------------------------------ */

export const MAX_APPLICATION_FILE_BYTES = 20 * 1024 * 1024;

/** Signatures for the two accepted sample formats. DOCX is a ZIP container. */
const APPLICATION_MAGIC: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: "application/pdf", test: (b) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    test: (b) => b.subarray(0, 4).toString("hex") === "504b0304",
  },
];

/** The real type of the bytes; the client's declared MIME is never trusted. */
export function detectApplicationFileType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  return APPLICATION_MAGIC.find((candidate) => candidate.test(buffer))?.mime ?? null;
}

/**
 * Refuses anything that is not a PDF or a DOCX. The sample work is private
 * (never rendered as HTML), so magic byte validation is the whole check; the
 * declared MIME is ignored because browsers send several shapes for DOCX.
 */
export function assertApplicationFileAcceptable(buffer: Buffer): string {
  const mime = detectApplicationFileType(buffer);
  if (!mime) {
    throw badRequest("Dosya türü tanınmadı. Yalnızca PDF ve DOCX kabul edilir.");
  }
  if (buffer.length > MAX_APPLICATION_FILE_BYTES) {
    throw badRequest(
      `Dosya çok büyük. Sınır: ${MAX_APPLICATION_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }
  return mime;
}

/* ------------------------------------------------------------------ */
/* Cooldown and readiness                                              */
/* ------------------------------------------------------------------ */

/** A reader may submit at most one application per rolling 30 days. */
export const APPLICATION_COOLDOWN_MS = 30 * 24 * 60 * 60_000;

/**
 * Whether the user may submit right now. The cooldown covers every outcome:
 * a rejected applicant waits the same 30 days as a successful one, so the
 * pipeline cannot be spammed with retries.
 */
export async function cooldownInfo(
  userId: string,
  now: Date = new Date(),
): Promise<{ withinCooldown: boolean; retryAt: Date | null }> {
  const rows = await db
    .select({ submittedAt: writerApplications.submittedAt })
    .from(writerApplications)
    .where(
      and(
        eq(writerApplications.userId, userId),
        gte(writerApplications.submittedAt, new Date(now.getTime() - APPLICATION_COOLDOWN_MS)),
      ),
    )
    .orderBy(desc(writerApplications.submittedAt))
    .limit(1);

  const last = rows[0]?.submittedAt;
  if (!last) return { withinCooldown: false, retryAt: null };
  return { withinCooldown: true, retryAt: new Date(last.getTime() + APPLICATION_COOLDOWN_MS) };
}

/** The applicant's most recent application, for the account page. */
export async function latestApplication(userId: string): Promise<WriterApplication | null> {
  const rows = await db
    .select()
    .from(writerApplications)
    .where(eq(writerApplications.userId, userId))
    .orderBy(desc(writerApplications.submittedAt))
    .limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Submitting                                                          */
/* ------------------------------------------------------------------ */

export const writerApplicationSchema = z.strictObject({
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function submitWriterApplication(
  actor: Actor,
  input: { buffer: Buffer; fileName: string; note?: string | null },
  meta: RequestMeta,
): Promise<WriterApplication> {
  if (!canSubmitApplication(actor)) {
    throw forbidden("Yalnızca normal kullanıcılar yazar başvurusu yapabilir.");
  }

  const user = await findUserById(actor.id);

  // The same prerequisites the promotion check enforces, checked before the
  // file is touched: no point storing a sample for an ineligible account
  const eligibility = checkWriterEligibility(user);
  if (!eligibility.eligible) {
    throw conflict("Başvuru için ön koşullar sağlanmıyor.", {
      requirements: eligibility.messages,
    });
  }

  const cooldown = await cooldownInfo(user.id);
  if (cooldown.withinCooldown) {
    const waitDays = Math.ceil(
      (cooldown.retryAt!.getTime() - Date.now()) / 86_400_000,
    );
    throw rateLimited(
      `Son 30 günde bir başvuru yaptınız. Yeni başvuru için ${waitDays} gün bekleyin.`,
    );
  }

  const parsed = writerApplicationSchema.safeParse({ note: input.note });
  if (!parsed.success) {
    throw badRequest("Başvuru bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const mime = assertApplicationFileAcceptable(input.buffer);
  const storageKey = buildStorageKey("writer-applications", input.fileName);
  try {
    await getStorage().put({ bucket: "media", key: storageKey, body: input.buffer, mime });
  } catch (error) {
    // The sample must exist before the application row does; a storage outage
    // is exactly where a silent failure would lose the file. Log the real
    // cause and tell the applicant plainly what happened.
    if (isAppError(error)) throw error;
    console.error("Sample work upload failed", error);
    throw badRequest(
      "Örnek eser dosyası depolamaya yüklenemedi. Lütfen sayfayı yenileyip tekrar deneyin.",
    );
  }

  const [sample] = await db
    .insert(media)
    .values({
      storageKey,
      mime,
      size: input.buffer.length,
      uploadedBy: user.id,
      licenseType: null, // not library material; no license fields apply
    })
    .returning();

  const [application] = await db
    .insert(writerApplications)
    .values({
      userId: user.id,
      status: "submitted",
      sampleMediaId: sample!.id,
      note: parsed.data.note ?? null,
      submittedAt: new Date(),
    })
    .returning();

  await writeAudit({
    actorId: user.id,
    action: "writer_application.submitted",
    entityType: "writer_applications",
    entityId: application!.id,
    after: { mime, size: input.buffer.length, note: application!.note },
    ip: meta.ip,
  });

  const message = templates.applicationSubmitted({ displayName: user.displayName });
  await sendMail({ to: user.email, subject: message.subject, text: message.text });

  return application!;
}

/* ------------------------------------------------------------------ */
/* Review stages                                                       */
/* ------------------------------------------------------------------ */

/**
 * The transition table, defined as data: an application moves through the
 * stages in one order only, and anything outside it is a 409.
 */
const TRANSITIONS: Record<WriterApplicationStatus, WriterApplicationStatus[]> = {
  submitted: ["editor_approved", "editor_rejected"],
  editor_approved: ["admin_approved", "admin_rejected"],
  admin_approved: ["signed"],
  signed: [],
  editor_rejected: [],
  admin_rejected: [],
};

function assertTransition(from: WriterApplicationStatus, to: WriterApplicationStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw conflict("Bu durumdan yapılan geçişe izin verilmiyor.");
  }
}

async function findApplication(applicationId: string): Promise<WriterApplication> {
  const rows = await db
    .select()
    .from(writerApplications)
    .where(eq(writerApplications.id, applicationId))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Başvuru bulunamadı.");
  return row;
}

/**
 * Stage one: the editor decides. An editor may not judge their own
 * application, which can happen if the applicant was promoted meanwhile.
 */
export async function editorDecideApplication(
  actor: Actor,
  applicationId: string,
  decision: "approve" | "reject",
  note: string | null,
  meta: RequestMeta,
): Promise<WriterApplication> {
  if (!canReviewApplications(actor)) throw forbidden("Başvuru inceleme yetkiniz yok.");
  if (decision === "reject" && !note?.trim()) {
    throw badRequest("Ret gerekçesi zorunludur.", { note: ["Ret gerekçesi zorunludur."] });
  }

  const application = await findApplication(applicationId);
  if (application.userId === actor.id) throw conflict("Kendi başvurunuzu değerlendiremezsiniz.");

  const target = decision === "approve" ? "editor_approved" : "editor_rejected";
  assertTransition(application.status, target);

  const now = new Date();
  const [updated] = await db
    .update(writerApplications)
    .set({
      status: target,
      reviewNote: note ?? null,
      editorBy: actor.id,
      editorReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(writerApplications.id, application.id))
    .returning();

  const applicant = await findUserById(application.userId);

  await writeAudit({
    actorId: actor.id,
    action:
      decision === "approve"
        ? "writer_application.editor_approved"
        : "writer_application.editor_rejected",
    entityType: "writer_applications",
    entityId: application.id,
    before: { status: application.status },
    after: { status: target, note },
    ip: meta.ip,
  });

  if (decision === "approve") {
    const message = templates.applicationEditorApproved({
      displayName: applicant.displayName,
    });
    await sendMail({ to: applicant.email, subject: message.subject, text: message.text });
  } else {
    const message = templates.applicationRejected({
      displayName: applicant.displayName,
      reason: note ?? "Açıklama belirtilmedi.",
    });
    await sendMail({ to: applicant.email, subject: message.subject, text: message.text });
  }

  return updated!;
}

/**
 * Stage two: the admin decides. Approving defines the contract: the current
 * agreement version is attached to the application, and it is that contract
 * the applicant will sign.
 */
export async function adminDecideApplication(
  actor: Actor,
  applicationId: string,
  decision: "approve" | "reject",
  note: string | null,
  meta: RequestMeta,
): Promise<WriterApplication> {
  if (!canFinalizeApplications(actor)) throw forbidden("Yalnızca yönetici onaylayabilir.");
  if (decision === "reject" && !note?.trim()) {
    throw badRequest("Ret gerekçesi zorunludur.", { note: ["Ret gerekçesi zorunludur."] });
  }

  const application = await findApplication(applicationId);
  if (application.userId === actor.id) throw conflict("Kendi başvurunuzu değerlendiremezsiniz.");

  const target = decision === "approve" ? "admin_approved" : "admin_rejected";
  assertTransition(application.status, target);

  let contractVersionId: string | null = null;
  if (decision === "approve") {
    const current = await getCurrentAgreement();
    if (!current) {
      throw conflict("Yayınlanmış bir sözleşme sürümü yok; önce bir sürüm yayınlayın.");
    }
    contractVersionId = current.id;
  }

  const now = new Date();
  const [updated] = await db
    .update(writerApplications)
    .set({
      status: target,
      reviewNote: note ?? null,
      adminBy: actor.id,
      adminReviewedAt: now,
      contractVersionId,
      updatedAt: now,
    })
    .where(eq(writerApplications.id, application.id))
    .returning();

  const applicant = await findUserById(application.userId);

  await writeAudit({
    actorId: actor.id,
    action:
      decision === "approve"
        ? "writer_application.admin_approved"
        : "writer_application.admin_rejected",
    entityType: "writer_applications",
    entityId: application.id,
    before: { status: application.status },
    after: { status: target, contractVersionId, note },
    ip: meta.ip,
  });

  if (decision === "approve") {
    const url = `${env().APP_URL}/writer-application/contract?application=${application.id}`;
    const message = templates.applicationContractReady({
      displayName: applicant.displayName,
      url,
    });
    await sendMail({ to: applicant.email, subject: message.subject, text: message.text });
  } else {
    const message = templates.applicationRejected({
      displayName: applicant.displayName,
      reason: note ?? "Açıklama belirtilmedi.",
    });
    await sendMail({ to: applicant.email, subject: message.subject, text: message.text });
  }

  return updated!;
}

/* ------------------------------------------------------------------ */
/* Contract signing (§6 of the writer-application module)              */
/* ------------------------------------------------------------------ */

export const applicationSignSchema = z.strictObject({
  agreementVersionId: z.uuid(),
  /** Hash of the filled text the browser displayed, re-derived server side. */
  renderedHash: z.string().length(64),
  acknowledged: z.literal(true, { message: "Onay kutusunu işaretlemeniz gerekiyor." }),
});

/**
 * The last stage: the applicant signs the contract that was defined at admin
 * approval. The signature records the acceptance, closes the application and
 * turns the account into an active writer — all or nothing, in one
 * transaction, with the `role_changes` row that every role change requires.
 */
export async function signApplicationContract(
  actor: Actor,
  applicationId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  const parsed = applicationSignSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Onay isteği geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }

  const application = await findApplication(applicationId);
  if (application.userId !== actor.id) throw forbidden("Bu başvuru size ait değil.");
  if (application.status !== "admin_approved") {
    throw conflict("Bu başvurunun sözleşmesi henüz imzalanmaya hazır değil.");
  }

  const user = await findUserById(actor.id);
  if (user.role !== "user") {
    throw conflict("Zaten yazar veya üzeri bir role sahipsiniz.");
  }

  // The contract defined at admin approval; if a newer version was published
  // since, the applicant signs the newer one, exactly like every writer does
  const current = await getCurrentAgreement();
  if (!current) throw notFound("Yayınlanmış bir çerçeve sözleşme yok.");
  if (current.id !== parsed.data.agreementVersionId) {
    throw conflict("Sözleşmenin daha yeni bir sürümü var. Sayfayı yenileyin.");
  }

  // The hash the browser echoes is never trusted: render again and compare
  const preview = await renderAgreementForWriter(user);
  if (preview.hash !== parsed.data.renderedHash) {
    throw conflict("Gösterilen metin ile kayıtlı metin eşleşmiyor. Sayfayı yenileyin.");
  }

  const acceptedAt = new Date();

  // The acceptance is stamped into the text: this is the final document
  const final = await renderAgreementForWriter(user, { acceptedAt, ip: meta.ip });

  // The readable copy, generated outside the transaction like `acceptAgreement`
  const pdf = await renderDocumentPdf({
    title: "postscript Yazar Sözleşmesi ve Kullanım Ruhsatı Taahhüdü",
    subtitle: `Sürüm ${current.version} · ${user.displayName}`,
    sections: [{ body: stripMarkdown(final.markdown) }],
    footerNote: `Sürüm ${current.version} — ${preview.hash.slice(0, 16)} — ${acceptedAt.toISOString()}`,
  });

  const pdfMedia = await storeGeneratedPdf(pdf, {
    prefix: "contracts",
    fileName: `sozlesme-v${current.version}-${user.id}.pdf`,
    uploadedBy: user.id,
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(agreementAcceptances)
      .values({
        userId: user.id,
        agreementVersionId: current.id,
        acceptedAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
        bodyHashAtAcceptance: preview.hash,
        renderedMarkdown: final.markdown,
        pdfMediaId: pdfMedia.id,
      })
      .onConflictDoNothing();

    // Signing is what closes the application…
    await tx
      .update(writerApplications)
      .set({ status: "signed", signedAt: acceptedAt, updatedAt: acceptedAt })
      .where(eq(writerApplications.id, application.id));

    // …and what makes the account an active writer
    await tx
      .update(users)
      .set({ role: "writer", writerStatus: "active", updatedAt: acceptedAt })
      .where(eq(users.id, user.id));
  });

  await recordRoleChange({
    userId: user.id,
    oldRole: "user",
    newRole: "writer",
    changedBy: user.id,
    note: `Yazar başvurusu sözleşmesi imzalandı (${application.id})`,
    ip: meta.ip,
  });

  await writeAudit({
    actorId: user.id,
    action: "writer_application.signed",
    entityType: "writer_applications",
    entityId: application.id,
    after: { version: current.version, bodyHashAtAcceptance: preview.hash },
    ip: meta.ip,
  });

  const message = templates.agreementAccepted({
    displayName: user.displayName,
    version: current.version,
  });
  await sendMail({
    to: user.email,
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

/* ------------------------------------------------------------------ */
/* Queues                                                              */
/* ------------------------------------------------------------------ */

export type ApplicationListItem = {
  id: string;
  status: WriterApplicationStatus;
  note: string | null;
  reviewNote: string | null;
  submittedAt: Date;
  sampleMediaId: string | null;
  contractVersionId: string | null;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantRole: Role | null;
  editorName: string | null;
  editorReviewedAt: Date | null;
  adminName: string | null;
  adminReviewedAt: Date | null;
};

const reviewers = alias(users, "reviewers");
const admins = alias(users, "admins");

/**
 * The review queues. Editors may only read the first stage (`submitted`);
 * anything further along is admin territory.
 */
export async function listApplicationsByStatus(
  actor: Actor,
  statuses: WriterApplicationStatus[],
  limit = 100,
): Promise<ApplicationListItem[]> {
  const needsFinalizer = statuses.some((status) => status !== "submitted");
  if (needsFinalizer && !canFinalizeApplications(actor)) throw forbidden();
  if (!needsFinalizer && !canReviewApplications(actor)) throw forbidden();

  return db
    .select({
      id: writerApplications.id,
      status: writerApplications.status,
      note: writerApplications.note,
      reviewNote: writerApplications.reviewNote,
      submittedAt: writerApplications.submittedAt,
      sampleMediaId: writerApplications.sampleMediaId,
      contractVersionId: writerApplications.contractVersionId,
      applicantName: users.displayName,
      applicantEmail: users.email,
      applicantRole: users.role,
      editorName: reviewers.displayName,
      editorReviewedAt: writerApplications.editorReviewedAt,
      adminName: admins.displayName,
      adminReviewedAt: writerApplications.adminReviewedAt,
    })
    .from(writerApplications)
    .innerJoin(users, eq(writerApplications.userId, users.id))
    .leftJoin(reviewers, eq(writerApplications.editorBy, reviewers.id))
    .leftJoin(admins, eq(writerApplications.adminBy, admins.id))
    .where(inArray(writerApplications.status, statuses))
    .orderBy(desc(writerApplications.submittedAt))
    .limit(limit);
}