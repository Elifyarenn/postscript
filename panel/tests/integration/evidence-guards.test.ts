/**
 * The database refuses to rewrite or remove evidence rows (D-349), while every
 * change the flows make on purpose still goes through: decisions on pending
 * uploads, revoking a licence, superseding acceptances, drafting and redrawing
 * unsent documents, clearing a deleted user's name off a version.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  agreementAcceptances,
  agreementVersions,
  articleVersions,
  articles,
  contributorDocuments,
  rightsGrants,
  signedContracts,
  users,
} from "@/db/schema";
import { createArticle, transitionArticle } from "@/services/articles";
import { revokeApproval } from "@/services/rights";
import { uploadCountersigned } from "@/services/signed-contracts";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  createUser,
  noMeta,
  publishContract,
  testIssueId,
  tinyPdf,
} from "../helpers/factories";

let database: Database;
const storage = new MemoryStorageAdapter();
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setStorageAdapter(storage);
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  storage.clear();
  mailbox.clear();
});

/** A writer with a verified contract: one approved signed_contracts row. */
async function verifiedWriter() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });
  await acceptCurrentContract(writer);
  const [contract] = await db.select().from(signedContracts).where(eq(signedContracts.userId, writer.id));
  return { admin, writer, contract: contract! };
}

/** A writer's own draft submitted for review, which records a signed declaration (D-238). */
async function declaredGrant() {
  const { admin, writer } = await verifiedWriter();
  const author = actorOf({ ...writer, writerStatus: "active" });
  await db.update(users).set({ writerStatus: "active" }).where(eq(users.id, writer.id));
  const article = await createArticle(
    actorOf(admin),
    { issueId: await testIssueId(), title: "Kanıt", summary: "Özet.", bodyMarkdown: "Gövde metni.", authorId: writer.id },
    noMeta,
  );
  await transitionArticle(author, article.id, "in_review", noMeta);
  const [grant] = await db.select().from(rightsGrants).where(eq(rightsGrants.articleId, article.id));
  return { writer, article, grant: grant! };
}

describe("signed_contracts", () => {
  it("refuses deleting a row or swapping its file or hash", async () => {
    const { contract } = await verifiedWriter();
    await expect(db.delete(signedContracts).where(eq(signedContracts.id, contract.id))).rejects.toThrow();
    await expect(
      db.update(signedContracts).set({ fileSha256: "0".repeat(64) }).where(eq(signedContracts.id, contract.id)),
    ).rejects.toThrow();
  });

  it("refuses reopening a decided upload", async () => {
    const { contract } = await verifiedWriter();
    await expect(
      db.update(signedContracts).set({ status: "pending" }).where(eq(signedContracts.id, contract.id)),
    ).rejects.toThrow();
  });

  it("stores the countersigned copy's hash and lets it be replaced", async () => {
    const { admin, contract } = await verifiedWriter();
    const upload = (tag: string) => ({ buffer: tinyPdf(tag), fileName: "iki-tarafli.pdf", declaredMime: "application/pdf" });

    await uploadCountersigned(actorOf(admin), contract.id, upload("ilk"), noMeta);
    const [first] = await db.select().from(signedContracts).where(eq(signedContracts.id, contract.id));
    expect(first!.countersignedSha256).toMatch(/^[0-9a-f]{64}$/);

    await uploadCountersigned(actorOf(admin), contract.id, upload("ikinci"), noMeta);
    const [second] = await db.select().from(signedContracts).where(eq(signedContracts.id, contract.id));
    expect(second!.countersignedSha256).not.toBe(first!.countersignedSha256);

    // Never a copy without its hash
    await expect(
      db.update(signedContracts).set({ countersignedMediaId: first!.countersignedMediaId, countersignedSha256: null }).where(eq(signedContracts.id, contract.id)),
    ).rejects.toThrow();
  });
});

describe("rights_grants", () => {
  it("fixes what a signed grant licensed", async () => {
    const { grant } = await declaredGrant();
    expect(grant.status).toBe("signed");
    await expect(
      db.update(rightsGrants).set({ formTextHash: "0".repeat(64) }).where(eq(rightsGrants.id, grant.id)),
    ).rejects.toThrow();
    await expect(
      db.update(rightsGrants).set({ acceptedBodyMarkdown: "Başka metin." }).where(eq(rightsGrants.id, grant.id)),
    ).rejects.toThrow();
    await expect(db.delete(rightsGrants).where(eq(rightsGrants.id, grant.id))).rejects.toThrow();
  });

  it("still revokes a signed grant, and a revoked one stays revoked", async () => {
    const { writer, article, grant } = await declaredGrant();
    await revokeApproval(article.id, writer.id, noMeta);
    const [revoked] = await db.select().from(rightsGrants).where(eq(rightsGrants.id, grant.id));
    expect(revoked!.status).toBe("revoked");

    await expect(db.update(rightsGrants).set({ status: "signed" }).where(eq(rightsGrants.id, grant.id))).rejects.toThrow();
  });
});

describe("agreement_acceptances", () => {
  async function acceptance() {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const [version] = await db.select().from(agreementVersions).limit(1);
    const [row] = await db
      .insert(agreementAcceptances)
      .values({ userId: admin.id, agreementVersionId: version!.id, bodyHashAtAcceptance: version!.bodyHash })
      .returning();
    return row!;
  }

  it("takes superseded_at once and nothing else", async () => {
    const row = await acceptance();
    await db.update(agreementAcceptances).set({ supersededAt: new Date() }).where(eq(agreementAcceptances.id, row.id));
    await expect(
      db.update(agreementAcceptances).set({ supersededAt: null }).where(eq(agreementAcceptances.id, row.id)),
    ).rejects.toThrow();
    await expect(
      db.update(agreementAcceptances).set({ bodyHashAtAcceptance: "0".repeat(64) }).where(eq(agreementAcceptances.id, row.id)),
    ).rejects.toThrow();
    await expect(db.delete(agreementAcceptances).where(eq(agreementAcceptances.id, row.id))).rejects.toThrow();
  });
});

describe("contributor_documents", () => {
  async function document(mailedAt: Date | null) {
    const user = await createUser({ role: "writer", writerStatus: "active" });
    const [row] = await db
      .insert(contributorDocuments)
      .values({
        kind: "general_agreement",
        userId: user.id,
        templateVersion: "1",
        status: "prepared",
        renderedMarkdown: "Sözleşme metni.",
        textHash: "a".repeat(64),
        mailedAt,
      })
      .returning();
    return row!;
  }

  it("leaves an unsent document a draft that can be redrawn or removed", async () => {
    const row = await document(null);
    await db.update(contributorDocuments).set({ renderedMarkdown: "Yeniden çizildi." }).where(eq(contributorDocuments.id, row.id));
    await db.delete(contributorDocuments).where(eq(contributorDocuments.id, row.id));
    expect(await db.select().from(contributorDocuments)).toHaveLength(0);
  });

  it("fixes a mailed document's text and keeps it", async () => {
    const row = await document(new Date());
    await expect(
      db.update(contributorDocuments).set({ renderedMarkdown: "Değişti." }).where(eq(contributorDocuments.id, row.id)),
    ).rejects.toThrow();
    await expect(
      db.update(contributorDocuments).set({ mailedAt: null }).where(eq(contributorDocuments.id, row.id)),
    ).rejects.toThrow();
    await expect(db.delete(contributorDocuments).where(eq(contributorDocuments.id, row.id))).rejects.toThrow();
  });
});

describe("article_versions", () => {
  it("refuses rewriting or deleting a version, but lets a deleted user's name go", async () => {
    const admin = await createUser({ role: "admin" });
    const editor = await createUser({ role: "editor" });
    const article = await createArticle(
      actorOf(admin),
      { issueId: await testIssueId(), title: "Sürümlü", summary: "Özet.", bodyMarkdown: "İlk metin." },
      noMeta,
    );
    const [version] = await db.select().from(articleVersions).where(eq(articleVersions.articleId, article.id));

    await expect(
      db.update(articleVersions).set({ bodyMarkdown: "Değişti." }).where(eq(articleVersions.id, version!.id)),
    ).rejects.toThrow();
    await expect(db.delete(articleVersions).where(eq(articleVersions.id, version!.id))).rejects.toThrow();

    // Who saved it cannot be rewritten; only ON DELETE SET NULL may clear it
    await expect(
      db.update(articleVersions).set({ changedBy: editor.id }).where(eq(articleVersions.id, version!.id)),
    ).rejects.toThrow();
    await db.update(articleVersions).set({ changedBy: null }).where(eq(articleVersions.id, version!.id));
    const [after] = await db.select().from(articleVersions).where(eq(articleVersions.id, version!.id));
    expect(after!.changedBy).toBeNull();
    expect((await db.select().from(articles).where(eq(articles.id, article.id)))[0]!.bodyMarkdown).toBe("İlk metin.");
  });
});

describe("agreement_versions", () => {
  it("refuses changing the text of a version someone signed", async () => {
    const { contract } = await verifiedWriter();
    await expect(
      db.update(agreementVersions).set({ bodyMarkdown: "Başka bir sözleşme." }).where(eq(agreementVersions.id, contract.agreementVersionId)),
    ).rejects.toThrow();
  });
});
