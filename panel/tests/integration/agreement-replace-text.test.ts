/**
 * Making the contributor contract v1 itself (D-283): the published version
 * keeps its number and date and takes the template's text, unless someone
 * has already signed it.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { agreementAcceptances, agreementVersions, auditLog, contributorDocuments } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { hashDocument } from "@/lib/agreement/normalise";
import { readAgreementTemplate } from "@/lib/agreement/template";
import { getCurrentAgreement, replaceVersionTextWithTemplate } from "@/services/agreements";
import { prepareContributorDocuments } from "@/services/contributor-documents";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { acceptCurrentContract, actorOf, createUser, noMeta, publishContract } from "../helpers/factories";

let database: Database;

beforeAll(async () => {
  database = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
});

const OLD_TEXT = "# Eski Yazar Sözleşmesi\n\nYazar: {{yazar.ad_soyad}}";

/** A published v1 with the old text, as production has it. */
async function oldV1() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));
  const current = (await getCurrentAgreement())!;
  await db
    .update(agreementVersions)
    .set({ bodyMarkdown: OLD_TEXT, bodyHash: hashDocument(OLD_TEXT), title: "Eski" })
    .where(eq(agreementVersions.id, current.id));
  return { admin, current: (await getCurrentAgreement())! };
}

describe("replaceVersionTextWithTemplate", () => {
  it("puts the template into v1, keeping its number and publication", async () => {
    const { admin, current } = await oldV1();
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.insert(agreementAcceptances).values({
      userId: writer.id,
      agreementVersionId: current.id,
      renderedMarkdown: "eski onay",
      bodyHashAtAcceptance: "b".repeat(64),
    });

    const updated = await replaceVersionTextWithTemplate(actorOf(admin), current.id, noMeta);
    expect(updated.version).toBe(current.version);
    expect(updated.publishedAt).toEqual(current.publishedAt);
    expect(updated.isCurrent).toBe(true);
    expect(updated.bodyMarkdown).toBe(readAgreementTemplate());
    expect(updated.bodyHash).toBe(hashDocument(readAgreementTemplate()));

    // The old acceptance was of the old text; it stays, marked superseded
    const [acceptance] = await db.select().from(agreementAcceptances);
    expect(acceptance!.supersededAt).not.toBeNull();

    const [audit] = await db.select().from(auditLog).where(eq(auditLog.action, "agreement.text_replaced_with_template"));
    expect((audit!.before as { bodyMarkdown: string }).bodyMarkdown).toBe(OLD_TEXT);

    // The contributor contracts no longer wait on the version
    await prepareContributorDocuments(actorOf(admin), noMeta);
    const [contract] = await db.select().from(contributorDocuments).where(eq(contributorDocuments.userId, writer.id));
    expect(contract!.reviewReasons.some((reason) => reason.includes("metni değil"))).toBe(false);
  });

  it("refuses once a signed copy of the version was uploaded", async () => {
    const { admin, current } = await oldV1();
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await acceptCurrentContract(writer);

    const attempt = await replaceVersionTextWithTemplate(actorOf(admin), current.id, noMeta).catch((error) => error);
    expect(isAppError(attempt) && attempt.status).toBe(409);
    expect((await getCurrentAgreement())!.bodyMarkdown).toBe(OLD_TEXT);
  });

  it("refuses when the text is already the template", async () => {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const current = (await getCurrentAgreement())!;
    const attempt = await replaceVersionTextWithTemplate(actorOf(admin), current.id, noMeta).catch((error) => error);
    expect(isAppError(attempt) && attempt.status).toBe(409);
  });

  it("is the admin's alone", async () => {
    const { current } = await oldV1();
    const editor = await createUser({ role: "editor" });
    const attempt = await replaceVersionTextWithTemplate(actorOf(editor), current.id, noMeta).catch((error) => error);
    expect(isAppError(attempt) && attempt.status).toBe(403);
    expect((await getCurrentAgreement())!.bodyMarkdown).toBe(OLD_TEXT);
  });
});
