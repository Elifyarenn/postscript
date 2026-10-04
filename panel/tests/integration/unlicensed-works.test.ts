/**
 * Removing the unlicensed works of removed writers (D-279): only those, only
 * the ones confirmed, as a soft delete that keeps the row and its history.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, auditLog, contributorDocuments, rightsGrants, roleChanges, users, type User } from "@/db/schema";
import { isAppError } from "@/lib/errors";
import { prepareContributorDocuments } from "@/services/contributor-documents";
import { listUnlicensedFormerWriterWorks, removeUnlicensedFormerWriterWorks } from "@/services/unlicensed-works";
import { articleHash } from "@/services/rights";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract, testIssueId } from "../helpers/factories";

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

const BODY = "Yazarın metni.";

async function work(author: User, status: (typeof articles.$inferInsert)["status"], title: string) {
  const [row] = await db
    .insert(articles)
    .values({ issueId: await testIssueId(), title, slug: title.toLowerCase().replace(/\W+/g, "-"), status, authorId: author.id, bodyMarkdown: BODY })
    .returning();
  return row!;
}

async function removedWriter(admin: User) {
  const person = await createUser({ role: "user" });
  await db.insert(roleChanges).values({ userId: person.id, oldRole: "writer", newRole: "user", changedBy: admin.id });
  return person;
}

async function scenario() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));

  const removed = await removedWriter(admin);
  const removedWithLicence = await removedWriter(admin);
  const writer = await createUser({ role: "writer", writerStatus: "active" });
  const neverWriter = await createUser({ role: "user" });

  const unlicensedPublished = await work(removed, "published", "Ruhsatsız Yayımlanmış");
  const unlicensedDraft = await work(removed, "draft", "Ruhsatsız Taslak");
  const licensed = await work(removedWithLicence, "published", "Ruhsatlı");
  await db.insert(rightsGrants).values({
    articleId: licensed.id,
    grantorId: removedWithLicence.id,
    grantType: "non_exclusive_license",
    formTextHash: articleHash(BODY),
    status: "signed",
    signedAt: new Date(),
  });
  const currentWriters = await work(writer, "draft", "Aktif Yazarın");
  const neverWriters = await work(neverWriter, "draft", "Hiç Yazar Olmamışın");

  return { admin, removed, removedWithLicence, writer, unlicensedPublished, unlicensedDraft, licensed, currentWriters, neverWriters };
}

describe("unlicensed works of removed writers", () => {
  it("lists the works of former writers, an old checkbox approval notwithstanding (D-282)", async () => {
    const s = await scenario();
    const list = await listUnlicensedFormerWriterWorks(actorOf(s.admin));
    expect(list.map((row) => row.id).sort()).toEqual([s.unlicensedPublished.id, s.unlicensedDraft.id, s.licensed.id].sort());
  });

  it("soft deletes the confirmed ones, keeps their rows, and removes their unsent documents", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const docsBefore = await db.select().from(contributorDocuments);
    expect(docsBefore.some((row) => row.userId === s.removed.id)).toBe(true);

    const result = await removeUnlicensedFormerWriterWorks(
      actorOf(s.admin),
      [s.unlicensedPublished.id, s.unlicensedDraft.id, s.licensed.id, s.currentWriters.id],
      noMeta,
    );
    expect(result.removed).toBe(3);

    const rows = await db.select().from(articles);
    const of = (id: string) => rows.find((row) => row.id === id)!;
    // The rows stay; only deleted_at is set, the status and text are untouched
    expect(of(s.unlicensedPublished.id).deletedAt).not.toBeNull();
    expect(of(s.unlicensedPublished.id).status).toBe("published");
    expect(of(s.unlicensedPublished.id).bodyMarkdown).toBe(BODY);
    expect(of(s.unlicensedDraft.id).deletedAt).not.toBeNull();
    expect(of(s.licensed.id).deletedAt).not.toBeNull();
    // Not in the list, so not removed even though its id was sent
    expect(of(s.currentWriters.id).deletedAt).toBeNull();
    expect(of(s.neverWriters.id).deletedAt).toBeNull();

    const docsAfter = await db.select().from(contributorDocuments);
    expect(docsAfter.some((row) => row.userId === s.removed.id)).toBe(false);
    expect(docsAfter.some((row) => row.articleId === s.licensed.id)).toBe(false);
    expect(result.documentsRemoved).toBe(docsBefore.length - docsAfter.length);

    const audit = await db.select().from(auditLog).where(eq(auditLog.action, "article.removed_unlicensed_former_writer"));
    expect(audit).toHaveLength(3);
    expect(await listUnlicensedFormerWriterWorks(actorOf(s.admin))).toHaveLength(0);
  });

  it("removes only what was confirmed", async () => {
    const s = await scenario();
    const result = await removeUnlicensedFormerWriterWorks(actorOf(s.admin), [s.unlicensedDraft.id], noMeta);
    expect(result.removed).toBe(1);
    const [kept] = await db.select().from(articles).where(eq(articles.id, s.unlicensedPublished.id));
    expect(kept!.deletedAt).toBeNull();
  });

  it("is the admin's alone", async () => {
    const s = await scenario();
    for (const actor of [actorOf(s.writer), actorOf(s.removed)]) {
      const attempt = await removeUnlicensedFormerWriterWorks(actor, [s.unlicensedDraft.id], noMeta).catch((error) => error);
      expect(isAppError(attempt) && attempt.status).toBe(403);
    }
    const [row] = await db.select().from(articles).where(eq(articles.id, s.unlicensedDraft.id));
    expect(row!.deletedAt).toBeNull();
    expect(await db.select().from(users)).toHaveLength(5);
  });

  it("keeps a document its owner was already mailed (D-314, D-316)", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const mailed = (await db.select().from(contributorDocuments)).filter((row) => row.userId === s.removed.id);
    expect(mailed.length).toBeGreaterThan(0);
    await db.update(contributorDocuments).set({ mailedAt: new Date() }).where(eq(contributorDocuments.userId, s.removed.id));

    await removeUnlicensedFormerWriterWorks(actorOf(s.admin), [s.unlicensedPublished.id, s.unlicensedDraft.id], noMeta);
    const after = (await db.select().from(contributorDocuments)).filter((row) => row.userId === s.removed.id);
    expect(after.map((row) => row.id).sort()).toEqual(mailed.map((row) => row.id).sort());
  });
});
