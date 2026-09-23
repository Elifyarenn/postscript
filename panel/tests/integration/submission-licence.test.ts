/**
 * The licence a writer declares by submitting a work (D-238).
 *
 * The rules this pins down: the framework contract is accepted once; creating or
 * saving a draft grants nothing; the author's own "send to the editors" is the
 * declaration for that work and is recorded with its text, version, contract
 * version, who and when; an editor moving the same article along is not the
 * writer's declaration; a resubmission supersedes the previous declaration; a
 * new contract version never inherits an old acceptance; and works submitted
 * before any acceptance are not swept in.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { agreementVersions, articles, rightsGrants, users } from "@/db/schema";
import { hasAcceptedCurrentAgreement, publishAgreementVersion } from "@/services/agreements";
import { hashDocument } from "@/lib/agreement/normalise";
import {
  createArticle,
  createArticleAsWriter,
  transitionArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import {
  articleHash,
  confirmUncoveredSubmissions,
  findLiveApproval,
  listUncoveredSubmissions,
} from "@/services/rights";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import {
  resetTables,
  seedDefaultWriterAreas,
  setupTestDatabase,
  teardownTestDatabase,
} from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  createUser,
  noMeta,
  publishContract,
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
    return null;
  } catch (error) {
    return isAppError(error) ? error : null;
  }
}

/** An admin with a published contract, plus a writer who has accepted it. */
async function scenario(options: { accept?: boolean } = {}) {
  const admin = await createUser({ role: "admin", displayName: "Ayşe Admin" });
  await publishContract(actorOf(admin));

  const writer = await createUser({
    role: "writer",
    writerStatus: "active",
    displayName: "Ada Yazar",
  });
  await db
    .update(users)
    .set({ writerArea: "Sanat & Edebiyat" })
    .where(eq(users.id, writer.id));
  const withArea = { ...writer, writerStatus: "active" as const, writerArea: "Sanat & Edebiyat" };

  if (options.accept !== false) await acceptCurrentContract(writer);

  return {
    adminActor: actorOf(admin) as Actor,
    writer: withArea,
    writerActor: actorOf(withArea) as Actor,
  };
}

async function draftOf(writerActor: Actor, title: string, body = "İlk gövde.") {
  return createArticleAsWriter(
    writerActor,
    { title, bodyMarkdown: body, category: "Sanat & Edebiyat" },
    noMeta,
  );
}

describe("the licence declared by submitting", () => {
  it("records the work's text, version, contract version, writer and time", async () => {
    const { writerActor, writer } = await scenario();
    const draft = await draftOf(writerActor, "Gönderim Beyanı");

    // Writing and saving a draft is not a declaration
    expect(await findLiveApproval(draft.id)).toBeNull();
    await updateArticleAsWriter(
      writerActor,
      draft.id,
      { title: "Gönderim Beyanı", bodyMarkdown: "Son gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    expect(await findLiveApproval(draft.id)).toBeNull();

    await transitionArticle(writerActor, draft.id, "in_review", noMeta, {});

    const grant = await findLiveApproval(draft.id);
    expect(grant?.status).toBe("signed");
    expect(grant?.grantorId).toBe(writer.id);
    expect(grant?.acceptedBodyMarkdown).toBe("Son gövde.");
    expect(grant?.formTextHash).toBe(articleHash("Son gövde."));
    expect(grant?.acceptedVersion).not.toBeNull();
    expect(grant?.agreementVersionId).not.toBeNull();
    expect(grant?.signedAt).toBeInstanceOf(Date);
  });

  it("refuses the submit until the contract has been accepted", async () => {
    const { writerActor } = await scenario({ accept: false });
    const draft = await draftOf(writerActor, "Sözleşmesiz");

    const error = await captureError(
      transitionArticle(writerActor, draft.id, "in_review", noMeta, {}),
    );
    expect(error?.status).toBe(409);
    expect(error?.message).toContain("yazar sözleşmesini kabul");

    const [row] = await db.select().from(articles).where(eq(articles.id, draft.id));
    expect(row!.status).toBe("draft");
    expect(await findLiveApproval(draft.id)).toBeNull();
  });

  it("does not treat an editor's transition as the writer's declaration", async () => {
    const { adminActor, writer } = await scenario();

    const article = await createArticle(
      adminActor,
      { title: "Editörün Gönderdiği", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );
    await transitionArticle(adminActor, article.id, "in_review", noMeta, {});

    expect(await findLiveApproval(article.id)).toBeNull();
  });

  it("supersedes the previous declaration when the writer resubmits", async () => {
    const { adminActor, writerActor } = await scenario();
    const draft = await draftOf(writerActor, "Yeniden Gönderim");

    await transitionArticle(writerActor, draft.id, "in_review", noMeta, {});
    const first = await findLiveApproval(draft.id);

    await transitionArticle(adminActor, draft.id, "revision_requested", noMeta, {
      note: "Girişi kısaltın.",
    });
    await updateArticleAsWriter(
      writerActor,
      draft.id,
      { title: "Yeniden Gönderim", bodyMarkdown: "İkinci gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    await transitionArticle(writerActor, draft.id, "in_review", noMeta, {});

    const second = await findLiveApproval(draft.id);
    expect(second!.id).not.toBe(first!.id);
    expect(second!.acceptedBodyMarkdown).toBe("İkinci gövde.");

    // The first one stays as history rather than being rewritten
    const [old] = await db.select().from(rightsGrants).where(eq(rightsGrants.id, first!.id));
    expect(old!.status).toBe("revoked");
    expect(old!.acceptedBodyMarkdown).toBe("İlk gövde.");
  });

  it("carries the work through to scheduling without a second approval step", async () => {
    const { adminActor, writerActor } = await scenario();
    const draft = await draftOf(writerActor, "Zincir");

    await transitionArticle(writerActor, draft.id, "in_review", noMeta, {});
    await transitionArticle(adminActor, draft.id, "pending_admin_approval", noMeta, {});
    await transitionArticle(adminActor, draft.id, "ready_for_publishing", noMeta, {});
    const accepted = await transitionArticle(adminActor, draft.id, "accepted", noMeta, {});

    expect(accepted.status).toBe("awaiting_rights");
    expect((await findLiveApproval(draft.id))?.status).toBe("signed");

    const scheduled = await transitionArticle(adminActor, draft.id, "scheduled", noMeta, {
      scheduledAt: new Date(Date.now() + 86_400_000),
    });
    expect(scheduled.status).toBe("scheduled");
  });
});

describe("a new contract version", () => {
  it("does not inherit the old acceptance", async () => {
    const { adminActor, writer } = await scenario();
    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(true);

    // The template file has not changed, so a second version is seeded directly
    const body = "Surum 2 metni: ayni kosullar, yeni surum.";
    const [next] = await db
      .insert(agreementVersions)
      .values({ version: 2, title: "Yazar Sözleşmesi", bodyMarkdown: body, bodyHash: hashDocument(body) })
      .returning();
    await publishAgreementVersion(adminActor, next!.id, noMeta);

    expect(await hasAcceptedCurrentAgreement(writer.id)).toBe(false);

    const draft = await draftOf(actorOf({ ...writer, writerStatus: "active" }), "Yeni Sürüm");
    const error = await captureError(
      transitionArticle(
        actorOf({ ...writer, writerStatus: "active" }),
        draft.id,
        "in_review",
        noMeta,
        {},
      ),
    );
    expect(error?.status).toBe(409);
  });
});

describe("works submitted before the contract was accepted", () => {
  it("lists them, leaves drafts out, and confirms each one separately", async () => {
    const { adminActor, writer } = await scenario({ accept: false });
    const writerActor = actorOf({ ...writer, writerStatus: "active" }) as Actor;

    // Submitted by an editor while no acceptance existed, so nothing covers them
    const first = await createArticle(
      adminActor,
      { title: "Eski Bir", bodyMarkdown: "Bir.", authorId: writer.id },
      noMeta,
    );
    const second = await createArticle(
      adminActor,
      { title: "Eski İki", bodyMarkdown: "İki.", authorId: writer.id },
      noMeta,
    );
    await transitionArticle(adminActor, first.id, "in_review", noMeta, {});
    await transitionArticle(adminActor, second.id, "in_review", noMeta, {});
    const stillDraft = await draftOf(writerActor, "Taslak Kalan");

    // Accepting the contract on its own covers none of them
    await acceptCurrentContract(writer);
    expect(await findLiveApproval(first.id)).toBeNull();

    const uncovered = await listUncoveredSubmissions(writerActor);
    expect(uncovered.map((row) => row.title)).toEqual(["Eski Bir", "Eski İki"]);
    expect(uncovered.map((row) => row.id)).not.toContain(stillDraft.id);

    expect(await confirmUncoveredSubmissions(writerActor, noMeta)).toBe(2);

    const firstGrant = await findLiveApproval(first.id);
    const secondGrant = await findLiveApproval(second.id);
    expect(firstGrant?.status).toBe("signed");
    expect(firstGrant?.acceptedBodyMarkdown).toBe("Bir.");
    expect(secondGrant?.acceptedBodyMarkdown).toBe("İki.");
    expect(await listUncoveredSubmissions(writerActor)).toEqual([]);
  });

  it("refuses the bulk confirmation before the contract is accepted", async () => {
    const { adminActor, writer } = await scenario({ accept: false });
    const article = await createArticle(
      adminActor,
      { title: "Teyitsiz", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );
    await transitionArticle(adminActor, article.id, "in_review", noMeta, {});

    const error = await captureError(
      confirmUncoveredSubmissions(actorOf({ ...writer, writerStatus: "active" }), noMeta),
    );
    expect(error?.status).toBe(409);
    expect(await findLiveApproval(article.id)).toBeNull();
  });
});
