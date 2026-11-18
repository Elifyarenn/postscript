/**
 * The licence form read and accepted when a work is handed in (D-387).
 *
 * The rules this pins down: an author's own submit needs an accepted form;
 * the form has to be the one for the text (or file) that arrives, so a change
 * after accepting is refused; a form number is used once; the accepted text,
 * its hashes and who accepted it from where are recorded with a PDF copy
 * mailed to the author; admins need none; a drawing is the same, named by
 * its file's hash and the record id chosen with the form; and works accepted
 * this way get no paper form from "Belgeleri hazırla".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, illustrations, licenceAcceptances, users } from "@/db/schema";
import { createArticleAsWriter, transitionArticle } from "@/services/articles";
import { uploadIllustration } from "@/services/illustrations";
import { licenceAcceptancePdf, listOwnLicenceAcceptances, previewArticleLicence } from "@/services/licence-acceptances";
import { prepareContributorDocuments } from "@/services/contributor-documents";
import { articleHash } from "@/services/rights";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import { resetTables, seedDefaultWriterAreas, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  acceptCurrentContract,
  acceptedDrawingLicence,
  acceptedLicence,
  actorOf,
  createUser,
  noMeta,
  publishContract,
  testIssueId,
} from "../helpers/factories";
import type { Actor } from "@/lib/auth/rbac";

let database: Database;
const mailbox = new MemoryMailAdapter();
const storage = new MemoryStorageAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
  setStorageAdapter(storage);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  await seedDefaultWriterAreas();
  mailbox.clear();
  storage.clear();
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected the call to fail, but it succeeded.");
}

async function scenario() {
  const admin = await createUser({ role: "admin", displayName: "Ayşe Admin" });
  await publishContract(actorOf(admin));
  const writer = await createUser({ role: "writer", writerStatus: "active", displayName: "Ada Yazar" });
  await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));
  await acceptCurrentContract(writer);
  const writerActor = actorOf({ ...writer, writerStatus: "active", writerArea: "Sanat & Edebiyat" }) as Actor;
  const draft = await createArticleAsWriter(
    writerActor,
    { issueId: await testIssueId(), title: "Kış Notları", bodyMarkdown: "Kar yağdı, şehir sustu.", category: "Sanat & Edebiyat" },
    noMeta,
  );
  return { admin, adminActor: actorOf(admin) as Actor, writer, writerActor, draft };
}

describe("handing an article in (D-387)", () => {
  it("refuses a submit without an accepted licence form and leaves the draft as it was", async () => {
    const { writerActor, draft } = await scenario();
    const error = await captureError(transitionArticle(writerActor, draft.id, "in_review", noMeta, {}));
    expect(error.status).toBe(409);
    expect(error.message).toContain("Ruhsat formunu okuyup onaylamadan");
    const [row] = await db.select().from(articles).where(eq(articles.id, draft.id));
    expect(row!.status).toBe("draft");
    expect(await db.select().from(licenceAcceptances)).toHaveLength(0);
  });

  it("refuses a form accepted for another text", async () => {
    const { writerActor, draft } = await scenario();
    const preview = await previewArticleLicence(writerActor, draft, { title: draft.title, bodyMarkdown: "Başka bir metin." });
    const error = await captureError(
      transitionArticle(writerActor, draft.id, "in_review", noMeta, {
        licence: { formId: preview.formId, textHash: preview.textHash },
      }),
    );
    expect(error.status).toBe(409);
    expect(error.message).toContain("eşleşmiyor");
  });

  it("records the accepted form, its hashes and the acceptance, and mails the PDF", async () => {
    const { writer, writerActor, draft } = await scenario();
    const options = await acceptedLicence(writerActor, draft.id);
    const sent = await transitionArticle(writerActor, draft.id, "in_review", noMeta, options);
    expect(sent.status).toBe("in_review");

    const [row] = await db.select().from(licenceAcceptances);
    expect(row!.id).toBe(options.licence!.formId);
    expect(row!.textHash).toBe(options.licence!.textHash);
    expect(row!.userId).toBe(writer.id);
    expect(row!.articleId).toBe(draft.id);
    expect(row!.templateVersion).toBe("13");
    expect(row!.contentHash).toBe(articleHash("Kar yağdı, şehir sustu."));
    expect(row!.renderedMarkdown).toContain("Kış Notları");
    expect(row!.renderedMarkdown).toContain("Elektronik Onay");
    expect(row!.renderedMarkdown).not.toContain("ıslak imza ile) imzalanır");
    expect(row!.ip).toBe(noMeta.ip);
    expect(row!.pdfMediaId).not.toBeNull();

    const mail = mailbox.outbox.find((message) => message.subject.includes("Ruhsat formunu onayladınız"));
    expect(mail?.to).toBe(writer.email);
    expect(mail?.attachments?.[0]?.contentType).toBe("application/pdf");

    expect(await listOwnLicenceAcceptances(writerActor)).toHaveLength(1);
    const pdf = await licenceAcceptancePdf(writerActor, row!.id);
    expect(pdf.body.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("uses a form number once", async () => {
    const { writerActor, draft } = await scenario();
    const options = await acceptedLicence(writerActor, draft.id);
    await transitionArticle(writerActor, draft.id, "in_review", noMeta, options);
    // Back to the author, then the same accepted form again
    await db.update(articles).set({ status: "revision_requested" }).where(eq(articles.id, draft.id));
    const error = await captureError(transitionArticle(writerActor, draft.id, "in_review", noMeta, options));
    expect(error.status).toBe(409);
  });

  it("keeps the PDF to its owner and the agreements admin", async () => {
    const { writerActor, adminActor, draft } = await scenario();
    await transitionArticle(writerActor, draft.id, "in_review", noMeta, await acceptedLicence(writerActor, draft.id));
    const [row] = await db.select().from(licenceAcceptances);
    const stranger = actorOf(await createUser({ role: "writer", writerStatus: "active" }));
    expect((await captureError(licenceAcceptancePdf(stranger, row!.id))).status).toBe(404);
    expect((await licenceAcceptancePdf(adminActor, row!.id)).body.length).toBeGreaterThan(0);
  });

  it("asks nothing of an admin writing for their own magazine (D-305)", async () => {
    const { adminActor } = await scenario();
    const own = await createArticleAsWriter(
      adminActor,
      { issueId: await testIssueId(), title: "Yönetici Yazısı", bodyMarkdown: "Metin.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    const sent = await transitionArticle(adminActor, own.id, "in_review", noMeta, {});
    expect(sent.status).toBe("in_review");
    expect(await db.select().from(licenceAcceptances)).toHaveLength(0);
  });

  it("draws no paper licence form for a work accepted this way", async () => {
    const { adminActor, writerActor, draft } = await scenario();
    await transitionArticle(writerActor, draft.id, "in_review", noMeta, await acceptedLicence(writerActor, draft.id));
    const summary = await prepareContributorDocuments(adminActor, noMeta);
    expect(summary.licenceCreated).toBe(0);
    expect(summary.skipped.map((entry) => entry.reason).join(" ")).toContain("elektronik olarak onaylandı");
  });
});

/** The first bytes of a PNG with its size in the header, padded to `length`. */
function png(width: number, height: number, length = 64): Buffer {
  const header = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, length - header.length))]);
}

describe("handing a drawing in (D-387)", () => {
  async function cizer() {
    const user = await createUser({ displayName: "Çizer Ece" });
    await db.update(users).set({ isIllustrator: true }).where(eq(users.id, user.id));
    return user;
  }
  const fields = async () => ({ title: "Kapak", note: null, issueId: await testIssueId() });

  it("refuses an upload without an accepted form", async () => {
    await scenario();
    const ece = await cizer();
    const error = await captureError(
      uploadIllustration(actorOf(ece), { buffer: png(10, 10), declaredMime: "image/png", fileName: "a.png", fields: await fields() }, noMeta),
    );
    expect(error.status).toBe(409);
    expect(await db.select().from(illustrations)).toHaveLength(0);
  });

  it("refuses a form accepted for another file", async () => {
    await scenario();
    const ece = await cizer();
    const accepted = await acceptedDrawingLicence(actorOf(ece), png(10, 10, 80), "image/png");
    const error = await captureError(
      uploadIllustration(
        actorOf(ece),
        { ...accepted, buffer: png(10, 10, 96), declaredMime: "image/png", fileName: "a.png", fields: await fields() },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
    expect(await db.select().from(illustrations)).toHaveLength(0);
  });

  it("stores the drawing under the id the form named, with the accepted form", async () => {
    await scenario();
    const ece = await cizer();
    const buffer = png(10, 10, 80);
    const accepted = await acceptedDrawingLicence(actorOf(ece), buffer, "image/png");
    const drawing = await uploadIllustration(
      actorOf(ece),
      { ...accepted, buffer, declaredMime: "image/png", fileName: "a.png", fields: await fields() },
      noMeta,
    );
    expect(drawing.id).toBe(accepted.illustrationId);
    const [row] = await db.select().from(licenceAcceptances);
    expect(row!.illustrationId).toBe(drawing.id);
    expect(row!.templateVersion).toBe("14");
    expect(row!.contentHash).toBe(createHash("sha256").update(buffer).digest("hex"));
    expect(row!.renderedMarkdown).toContain(`Çizim ${drawing.id.slice(0, 8)}`);
  });
});
