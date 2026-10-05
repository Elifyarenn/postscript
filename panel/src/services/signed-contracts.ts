/**
 * Signed contracts: the member uploads the signed Yazar Sözleşmesi as a PDF,
 * an admin checks it and records the signed contract verification (D-275).
 *
 * This is the only thing that now counts as a member having a contract:
 * `hasAcceptedCurrentAgreement` in `agreements.ts` reads this table. The
 * checkbox acceptances in `agreement_acceptances` are kept untouched as
 * history and count for nothing.
 *
 *   pending ──approve──▶ approved
 *      └─────reject───▶ rejected   (reason required; the member uploads again)
 *
 * Who may do what is decided here, on the server, whatever a page shows:
 * a member sees and uploads only their own; an admin sees and decides all,
 * but never their own upload.
 */
import "server-only";
import { createHash } from "node:crypto";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  agreementVersions,
  articles,
  contributorDocuments,
  issueQuizzes,
  media,
  signedContracts,
  users,
  writerApplications,
  type SignedContract,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import { uniqueEntryNames, type ZipEntry } from "@/lib/zip";
import { canAccessIllustratorPanel, canAccessWriterPanel, canManageAgreements, type Actor } from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { getCurrentAgreement } from "./agreements";
import { stillContributing } from "./contributor-documents";
import { detectFileType, storeGeneratedPdf } from "./media";
import { checkWriterEligibility, findUserById } from "./users";
import { completeApplicationWithSignedContract } from "./writer-applications";
import type { RequestMeta } from "./auth";

/**
 * A scanned or e-signed contract fits easily. The real ceiling is Vercel's
 * 4.5 MB request body (D-161); 4 MB leaves room for the form around it.
 */
export const MAX_SIGNED_CONTRACT_MB = 4;
const MAX_SIGNED_CONTRACT_BYTES = MAX_SIGNED_CONTRACT_MB * 1024 * 1024;

export const VERIFIED_MESSAGE = "İmzalı sözleşmeniz doğrulandı.";

export type SignedContractStatus = SignedContract["status"];
type ContributorDocument = typeof contributorDocuments.$inferSelect;

/** The member's own open application that is waiting for its contract, if any. */
async function applicationAwaitingContract(userId: string) {
  const [row] = await db
    .select({ id: writerApplications.id })
    .from(writerApplications)
    .where(and(eq(writerApplications.userId, userId), eq(writerApplications.status, "admin_approved")))
    .limit(1);
  return row ?? null;
}

/**
 * Team members (writer and above) upload from their panel; an applicant whose
 * application the admin approved uploads to finish it. Nobody else.
 */
async function mayUpload(actor: Actor): Promise<boolean> {
  if (canAccessWriterPanel(actor)) return true;
  // A çizer signs the same contributor contract (D-288)
  if (canAccessIllustratorPanel(actor, (await findUserById(actor.id)).isIllustrator)) return true;
  return actor.role === "user" && (await applicationAwaitingContract(actor.id)) !== null;
}

export type OwnSignedContract = {
  id: string;
  status: SignedContractStatus;
  version: number;
  fileMediaId: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  /** The prepared document it signs (D-289); null for the contract uploaded on its own. */
  contributorDocumentId: string | null;
  /** True when it is the contract rather than a work's licence form. */
  isContract: boolean;
  articleTitle: string | null;
  /** The copy signed by both sides, once the magazine has uploaded it (D-290). */
  countersignedMediaId: string | null;
};

const signedDocuments = alias(contributorDocuments, "signed_documents");
const signedWorks = alias(articles, "signed_works");
const signedQuizzes = alias(issueQuizzes, "signed_quizzes");
/** The licensed work's title: an article's, or a quiz's (D-300). */
const signedWorkTitle = sql<string | null>`coalesce(${signedWorks.title}, ${signedQuizzes.title})`;

/** The member's own uploads, newest first. Nobody else's. */
export async function listOwnSignedContracts(actor: Pick<Actor, "id">): Promise<OwnSignedContract[]> {
  const rows = await db
    .select({
      id: signedContracts.id,
      status: signedContracts.status,
      version: agreementVersions.version,
      fileMediaId: signedContracts.fileMediaId,
      uploadedAt: signedContracts.uploadedAt,
      reviewedAt: signedContracts.reviewedAt,
      rejectionReason: signedContracts.rejectionReason,
      contributorDocumentId: signedContracts.contributorDocumentId,
      documentKind: signedDocuments.kind,
      articleTitle: signedWorkTitle,
      countersignedMediaId: signedContracts.countersignedMediaId,
    })
    .from(signedContracts)
    .innerJoin(agreementVersions, eq(signedContracts.agreementVersionId, agreementVersions.id))
    .leftJoin(signedDocuments, eq(signedContracts.contributorDocumentId, signedDocuments.id))
    .leftJoin(signedWorks, eq(signedDocuments.articleId, signedWorks.id))
    .leftJoin(signedQuizzes, eq(signedDocuments.quizId, signedQuizzes.id))
    .where(eq(signedContracts.userId, actor.id))
    .orderBy(desc(signedContracts.uploadedAt));
  return rows.map(({ documentKind, ...row }) => ({ ...row, isContract: documentKind !== "work_licence" }));
}

/**
 * Checks the file and records it as `pending`. With a document id it is the
 * signed copy of that prepared document (D-289): one upload right per
 * document the member was sent, so a contract and two licence forms are
 * three files. Without one it is the contract for the current version, as
 * before. The name, the declared type and the bytes must all say PDF.
 */
export async function uploadSignedContract(
  actor: Actor,
  input: { buffer: Buffer; fileName: string; declaredMime: string; documentId?: string | null },
  meta: RequestMeta,
): Promise<{ id: string }> {
  const document = input.documentId ? await ownPreparedDocument(actor, input.documentId) : null;
  // Owning a prepared document is itself the right to send its signed copy
  if (!document && !(await mayUpload(actor))) throw forbidden("İmzalı sözleşme yükleme yetkiniz yok.");

  assertPdf(input);

  const user = await findUserById(actor.id);
  if (!user.emailVerifiedAt) {
    throw conflict("Sözleşme yüklemeden önce e-posta adresinizi doğrulamanız gerekiyor.");
  }
  return recordUpload({ memberId: actor.id, uploaderId: actor.id, document, buffer: input.buffer }, meta);
}

/**
 * An admin uploads the signed copy of a member's prepared document for them
 * (D-303): the member signed it but could not upload it from their phone and
 * sent it another way. Only for a document the magazine prepared for that
 * member, so the file is tied to a known text. It lands as `pending` like any
 * upload and is verified the usual way; the admin stays on record as the
 * file's uploader and in the audit log.
 */
export async function uploadSignedContractForMember(
  actor: Actor,
  input: { buffer: Buffer; fileName: string; declaredMime: string; documentId: string },
  meta: RequestMeta,
): Promise<{ id: string }> {
  if (!canManageAgreements(actor)) throw forbidden();
  const document = await preparedDocument(input.documentId);
  if (document.userId === actor.id) throw forbidden("Kendi belgenizi kendi panelinizden yükleyin.");

  assertPdf(input);

  const member = await findUserById(document.userId);
  if (!member.emailVerifiedAt) {
    throw conflict("Bu kişi e-posta adresini doğrulamamış; adına belge yüklenemez.");
  }
  return recordUpload({ memberId: member.id, uploaderId: actor.id, document, buffer: input.buffer }, meta);
}

/**
 * The common tail of both uploads: one pending file per document and none
 * once it is verified, stored privately, audited under whoever uploaded it.
 */
async function recordUpload(
  input: { memberId: string; uploaderId: string; document: ContributorDocument | null; buffer: Buffer },
  meta: RequestMeta,
): Promise<{ id: string }> {
  const { document } = input;
  const byAdmin = input.uploaderId !== input.memberId;

  const current = await getCurrentAgreement();
  if (!current) throw conflict("Yayınlanmış bir sözleşme sürümü yok.");

  const own = await listOwnSignedContracts({ id: input.memberId });
  // The same document, or for an upload without one the contract alone
  const same = own.filter((row) =>
    document ? row.contributorDocumentId === document.id : row.contributorDocumentId === null,
  );
  if (same.some((row) => row.status === "pending")) {
    throw conflict(
      byAdmin
        ? "Bu belge için yüklenmiş bir dosya zaten inceleniyor; önce onu doğrulayın ya da reddedin."
        : "Bu belge için yüklediğiniz dosya inceleniyor. Sonuçlanmadan yenisini yükleyemezsiniz.",
    );
  }
  if (document ? same.some((row) => row.status === "approved") : own.some((row) => row.isContract && row.status === "approved" && row.version === current.version)) {
    throw conflict(document ? "Bu belgenin imzalı kopyası zaten doğrulandı." : "Bu sürüm için imzalı sözleşmeniz zaten doğrulandı.");
  }

  // Private, under `contracts/`: served only to the member and to an admin
  const file = await storeGeneratedPdf(input.buffer, {
    prefix: "contracts/signed",
    fileName: document?.kind === "work_licence" ? `imzali-ruhsat-${document.id.slice(0, 8)}.pdf` : `imzali-sozlesme-v${current.version}.pdf`,
    uploadedBy: input.uploaderId,
  });

  const [row] = await db
    .insert(signedContracts)
    .values({
      userId: input.memberId,
      agreementVersionId: document?.agreementVersionId ?? current.id,
      contributorDocumentId: document?.id ?? null,
      fileMediaId: file.id,
      fileSha256: createHash("sha256").update(input.buffer).digest("hex"),
      status: "pending",
    })
    .onConflictDoNothing()
    .returning({ id: signedContracts.id });
  // A second tab raced this one to the single pending slot
  if (!row) throw conflict("Bu belge için yüklediğiniz dosya inceleniyor. Sonuçlanmadan yenisini yükleyemezsiniz.");

  await writeAudit({
    actorId: input.uploaderId,
    action: byAdmin ? "signed_contract.uploaded_for_member" : "signed_contract.uploaded",
    entityType: "signed_contracts",
    entityId: row.id,
    after: {
      version: current.version,
      size: input.buffer.length,
      contributorDocumentId: document?.id ?? null,
      ...(byAdmin ? { memberId: input.memberId } : {}),
    },
    ip: meta.ip,
  });
  return row;
}

/** The name, the declared type and the bytes must all say PDF, within the size limit. */
function assertPdf(input: { buffer: Buffer; fileName: string; declaredMime: string }): void {
  if (!/\.pdf$/i.test(input.fileName.trim())) {
    throw badRequest("Yalnızca PDF dosyası yükleyebilirsiniz (.pdf).");
  }
  if (input.declaredMime !== "application/pdf" || detectFileType(input.buffer)?.mime !== "application/pdf") {
    throw badRequest("Dosya içeriği PDF değil. Yalnızca PDF dosyası yükleyebilirsiniz.");
  }
  if (input.buffer.length > MAX_SIGNED_CONTRACT_BYTES) {
    throw badRequest(`Dosya çok büyük. Sınır: ${MAX_SIGNED_CONTRACT_MB} MB.`);
  }
}

/** A prepared document of the actor's own; anyone else's is "not found". */
async function ownPreparedDocument(actor: Actor, id: string): Promise<ContributorDocument> {
  const row = await preparedDocument(id);
  if (row.userId !== actor.id) throw notFound("Belge bulunamadı.");
  return row;
}

/** Anyone's prepared document; the caller decides who may touch it. */
async function preparedDocument(id: string): Promise<ContributorDocument> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw notFound("Belge bulunamadı.");
  const [row] = await db.select().from(contributorDocuments).where(eq(contributorDocuments.id, id)).limit(1);
  if (!row) throw notFound("Belge bulunamadı.");
  if (row.status !== "prepared") throw conflict("Bu belge henüz hazır değil; imzalı kopyası yüklenemez.");
  return row;
}

export type SignedContractListItem = {
  id: string;
  status: SignedContractStatus;
  version: number;
  isCurrentVersion: boolean;
  fileMediaId: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  memberId: string;
  memberName: string;
  memberRole: string;
  memberIsMainEditor: boolean;
  memberIsIllustrator: boolean;
  reviewerName: string | null;
  isContract: boolean;
  articleTitle: string | null;
};

const reviewers = alias(users, "reviewers");

/** Every upload for the admin, newest first, with the document it signs. */
export async function listSignedContracts(actor: Actor): Promise<SignedContractListItem[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  const rows = await db
    .select({
      id: signedContracts.id,
      status: signedContracts.status,
      version: agreementVersions.version,
      isCurrentVersion: agreementVersions.isCurrent,
      fileMediaId: signedContracts.fileMediaId,
      uploadedAt: signedContracts.uploadedAt,
      reviewedAt: signedContracts.reviewedAt,
      rejectionReason: signedContracts.rejectionReason,
      memberId: users.id,
      memberName: users.displayName,
      memberRole: users.role,
      memberIsMainEditor: users.isMainEditor,
      memberIsIllustrator: users.isIllustrator,
      reviewerName: reviewers.displayName,
      documentKind: signedDocuments.kind,
      articleTitle: signedWorkTitle,
    })
    .from(signedContracts)
    .innerJoin(users, eq(signedContracts.userId, users.id))
    .innerJoin(agreementVersions, eq(signedContracts.agreementVersionId, agreementVersions.id))
    .leftJoin(reviewers, eq(signedContracts.reviewedBy, reviewers.id))
    .leftJoin(signedDocuments, eq(signedContracts.contributorDocumentId, signedDocuments.id))
    .leftJoin(signedWorks, eq(signedDocuments.articleId, signedWorks.id))
    .leftJoin(signedQuizzes, eq(signedDocuments.quizId, signedQuizzes.id))
    .orderBy(desc(signedContracts.uploadedAt));
  return rows.map(({ documentKind, ...row }) => ({ ...row, isContract: documentKind !== "work_licence" }));
}

/** Whether a signed upload is the contract (with or without a document) rather than a licence form. */
async function isContractUpload(row: SignedContract): Promise<boolean> {
  if (!row.contributorDocumentId) return true;
  const [document] = await db
    .select({ kind: contributorDocuments.kind })
    .from(contributorDocuments)
    .where(eq(contributorDocuments.id, row.contributorDocumentId))
    .limit(1);
  return document?.kind !== "work_licence";
}

async function pendingForReview(actor: Actor, id: string): Promise<SignedContract> {
  if (!canManageAgreements(actor)) throw forbidden();
  const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id)).limit(1);
  if (!row) throw notFound("Sözleşme kaydı bulunamadı.");
  if (row.userId === actor.id) throw forbidden("Kendi sözleşmenizi doğrulayamazsınız.");
  if (row.status !== "pending") throw conflict("Bu kayıt zaten sonuçlandırılmış.");
  return row;
}

/**
 * The signed contract verification. The upload must be for the version that
 * is current now: a contract signed on an older text is rejected instead, and
 * the member signs the current one.
 *
 * In the same transaction a writer waiting for their contract becomes active
 * (never a frozen one, D-248), and an applicant's approved application closes
 * and the account becomes a writer, with its `role_changes` row.
 */
export async function approveSignedContract(actor: Actor, id: string, meta: RequestMeta): Promise<void> {
  const row = await pendingForReview(actor, id);
  const current = await getCurrentAgreement();
  if (!current || current.id !== row.agreementVersionId) {
    throw conflict("Bu dosya güncel olmayan bir sözleşme sürümü için yüklenmiş; reddedip güncel sürümü isteyin.");
  }

  const member = await findUserById(row.userId);
  // A licence form's signed copy is recorded only; the contract is what activates (D-289)
  const contract = await isContractUpload(row);
  const application = contract && member.role === "user" ? await applicationAwaitingContract(member.id) : null;
  if (application) {
    // The promotion prerequisites, checked again at the moment of promotion
    const eligibility = checkWriterEligibility(member);
    if (!eligibility.eligible) {
      throw conflict("Yazar terfisi için ön koşullar sağlanmıyor.", { requirements: eligibility.messages });
    }
  }

  const reviewedAt = new Date();
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(signedContracts)
      .set({ status: "approved", reviewedAt, reviewedBy: actor.id, updatedAt: reviewedAt })
      .where(and(eq(signedContracts.id, row.id), eq(signedContracts.status, "pending")))
      .returning({ id: signedContracts.id });
    if (!updated) throw conflict("Bu kayıt zaten sonuçlandırılmış.");

    if (application) {
      await completeApplicationWithSignedContract(tx, {
        applicationId: application.id,
        userId: member.id,
        oldRole: member.role,
        verifiedBy: actor.id,
        at: reviewedAt,
        ip: meta.ip,
      });
    } else if (contract && member.role === "writer" && member.writerStatus !== "suspended") {
      await tx
        .update(users)
        .set({ writerStatus: "active", updatedAt: reviewedAt })
        .where(and(eq(users.id, member.id), eq(users.role, "writer")));
    }
  });

  await writeAudit({
    actorId: actor.id,
    action: "signed_contract.verified",
    entityType: "signed_contracts",
    entityId: row.id,
    after: { userId: row.userId, version: current.version, promoted: application !== null },
    ip: meta.ip,
  });
}

/** Rejection needs a reason; the member reads it and uploads a new file. */
export async function rejectSignedContract(
  actor: Actor,
  id: string,
  rawReason: string,
  meta: RequestMeta,
): Promise<void> {
  const reason = rawReason.trim();
  if (reason.length < 3 || reason.length > 1000) {
    throw badRequest("Ret nedeni zorunludur (3–1000 karakter).", {
      reason: ["Ret nedeni zorunludur (3–1000 karakter)."],
    });
  }
  const row = await pendingForReview(actor, id);

  const reviewedAt = new Date();
  const [updated] = await db
    .update(signedContracts)
    .set({ status: "rejected", reviewedAt, reviewedBy: actor.id, rejectionReason: reason, updatedAt: reviewedAt })
    .where(and(eq(signedContracts.id, row.id), eq(signedContracts.status, "pending")))
    .returning({ id: signedContracts.id });
  if (!updated) throw conflict("Bu kayıt zaten sonuçlandırılmış.");

  await writeAudit({
    actorId: actor.id,
    action: "signed_contract.rejected",
    entityType: "signed_contracts",
    entityId: row.id,
    after: { userId: row.userId },
    ip: meta.ip,
  });
}

/* ------------------------------------------------------------------ */
/* The magazine's signature (D-290)                                    */
/* ------------------------------------------------------------------ */

export type CountersignItem = {
  id: string;
  memberId: string;
  memberName: string;
  isContract: boolean;
  articleTitle: string | null;
  version: number;
  fileMediaId: string;
  reviewedAt: Date | null;
  countersignedMediaId: string | null;
  countersignedAt: Date | null;
  countersignerName: string | null;
};

const countersigners = alias(users, "countersigners");

/**
 * Every verified upload in one place, for the magazine to sign: those still
 * waiting for its signature first, then the finished ones. Someone no longer
 * contributing is left out (D-322) unless `includeFormer` asks for the archive.
 */
export async function listForCountersign(
  actor: Actor,
  { includeFormer = false }: { includeFormer?: boolean } = {},
): Promise<CountersignItem[]> {
  if (!canManageAgreements(actor)) throw forbidden();
  const rows = await db
    .select({
      id: signedContracts.id,
      memberId: users.id,
      memberName: users.displayName,
      version: agreementVersions.version,
      fileMediaId: signedContracts.fileMediaId,
      reviewedAt: signedContracts.reviewedAt,
      countersignedMediaId: signedContracts.countersignedMediaId,
      countersignedAt: signedContracts.countersignedAt,
      countersignerName: countersigners.displayName,
      documentKind: signedDocuments.kind,
      articleTitle: signedWorkTitle,
    })
    .from(signedContracts)
    .innerJoin(users, eq(signedContracts.userId, users.id))
    .innerJoin(agreementVersions, eq(signedContracts.agreementVersionId, agreementVersions.id))
    .leftJoin(countersigners, eq(signedContracts.countersignedBy, countersigners.id))
    .leftJoin(signedDocuments, eq(signedContracts.contributorDocumentId, signedDocuments.id))
    .leftJoin(signedWorks, eq(signedDocuments.articleId, signedWorks.id))
    .leftJoin(signedQuizzes, eq(signedDocuments.quizId, signedQuizzes.id))
    .where(and(eq(signedContracts.status, "approved"), includeFormer ? undefined : stillContributing()))
    .orderBy(users.displayName, signedContracts.reviewedAt);
  const items = rows.map(({ documentKind, ...row }) => ({ ...row, isContract: documentKind !== "work_licence" }));
  return [...items.filter((row) => !row.countersignedMediaId), ...items.filter((row) => row.countersignedMediaId)];
}

/** A file name a person can read in the ZIP: who, and which document. */
export function countersignFileName(item: Pick<CountersignItem, "memberName" | "isContract" | "articleTitle" | "version">): string {
  const what = item.isContract ? `genel-sozlesme-v${item.version}` : `ruhsat-${item.articleTitle ?? "eser"}`;
  const safe = `${item.memberName} - ${what}`
    .normalize("NFC")
    .replace(/[\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${safe}.pdf`;
}

/**
 * The member-signed PDFs as ZIP entries, loaded one at a time: those still
 * waiting for the magazine's signature, or every verified one.
 */
export async function countersignZipEntries(
  actor: Actor,
  which: "waiting" | "all",
): Promise<{ count: number; entries: AsyncIterable<ZipEntry> }> {
  // The full archive keeps former contributors' signed copies; the to-sign set does not
  const items = (await listForCountersign(actor, { includeFormer: which === "all" })).filter(
    (row) => which === "all" || !row.countersignedMediaId,
  );
  const names = uniqueEntryNames(items.map(countersignFileName));
  async function* entries(): AsyncGenerator<ZipEntry> {
    for (const [index, item] of items.entries()) {
      const [file] = await db.select().from(media).where(eq(media.id, item.fileMediaId)).limit(1);
      if (!file) continue;
      const body = await getStorage().get({ bucket: "media", key: file.storageKey });
      yield { name: names[index]!, data: new Uint8Array(body), modified: item.reviewedAt ?? undefined };
    }
  }
  return { count: items.length, entries: entries() };
}

/**
 * The copy signed by both sides, uploaded by an admin for a verified upload.
 * Uploading again replaces it; the earlier file stays in storage and its id in
 * the audit log.
 */
export async function uploadCountersigned(
  actor: Actor,
  id: string,
  input: { buffer: Buffer; fileName: string; declaredMime: string },
  meta: RequestMeta,
): Promise<void> {
  if (!canManageAgreements(actor)) throw forbidden();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw notFound("Sözleşme kaydı bulunamadı.");
  const [row] = await db.select().from(signedContracts).where(eq(signedContracts.id, id)).limit(1);
  if (!row) throw notFound("Sözleşme kaydı bulunamadı.");
  if (row.status !== "approved") throw conflict("Yalnızca doğrulanmış bir sözleşmenin karşı imzalı hâli yüklenebilir.");
  assertPdf(input);

  // Private, under `contracts/`: the member and the admins read it
  const file = await storeGeneratedPdf(input.buffer, {
    prefix: "contracts/countersigned",
    fileName: `iki-tarafli-imzali-${row.id.slice(0, 8)}.pdf`,
    uploadedBy: actor.id,
  });
  const now = new Date();
  await db
    .update(signedContracts)
    .set({ countersignedMediaId: file.id, countersignedAt: now, countersignedBy: actor.id, updatedAt: now })
    .where(eq(signedContracts.id, row.id));

  await writeAudit({
    actorId: actor.id,
    action: "signed_contract.countersigned",
    entityType: "signed_contracts",
    entityId: row.id,
    before: { countersignedMediaId: row.countersignedMediaId },
    after: {
      countersignedMediaId: file.id,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      userId: row.userId,
    },
    ip: meta.ip,
  });
}
