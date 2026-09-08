/**
 * The editorial lifecycle end to end, against a real PostgreSQL.
 *
 * These are the rules the contract specification calls out: acceptance opens a
 * work approval whose scope comes from the contract and not from a form, an
 * unapproved work cannot be scheduled, the approved text is pinned by its hash,
 * a content change revokes the approval, and a withdrawn work answers 410.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articleMedia, articles, media, rightsGrants, users } from "@/db/schema";
import { publishAgreementVersion, createVersionFromTemplate } from "@/services/agreements";
import {
  createArticle,
  declineWorkAndReturnForRevision,
  publishScheduledArticles,
  transitionArticle,
  updateArticle,
} from "@/services/articles";
import { attachMediaToArticle } from "@/services/media";
import { createIssue, setIssueStatus } from "@/services/issues";
import { getPublicArticle, getPublishedIssue } from "@/services/public";
import { approveWork, articleHash, findLiveApproval, LICENCE_TERMS } from "@/services/rights";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import {
  acceptCurrentContract,
  actorOf,
  adminActor,
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

/** An admin, an editor, an active writer and an article assigned to them. */
async function scenario() {
  const admin = await createUser({ role: "admin" });
  const editor = await createUser({ role: "editor" });
  const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });

  await publishContract(actorOf(admin));
  await acceptCurrentContract(writer);

  const article = await createArticle(
    actorOf(editor),
    {
      title: "Kayıp Zamanın İzinde",
      summary: "Bir deneme.",
      bodyMarkdown: "# Başlık\n\nGövde metni.",
      authorId: writer.id,
    },
    noMeta,
  );

  return {
    admin: actorOf(admin),
    editor: actorOf(editor),
    writer: actorOf({ ...writer, writerStatus: "active" }),
    writerRow: writer,
    article,
  };
}

/** Walks an article from draft to awaiting_rights, where the approval opens. */
async function toAwaitingRights(editor: Actor, articleId: string) {
  await transitionArticle(editor, articleId, "in_review", noMeta);
  return transitionArticle(editor, articleId, "accepted", noMeta);
}

/** Approves the work as the writer would, echoing the current text hash. */
async function approveAsWriter(
  writer: Actor,
  articleId: string,
  byline: "real_name" | "pen_name" = "real_name",
) {
  const approval = await findLiveApproval(articleId);
  const rows = await db.select().from(articles).where(eq(articles.id, articleId));

  return approveWork(
    writer,
    {
      grantId: approval!.id,
      articleHash: articleHash(rows[0]!.bodyMarkdown),
      bylineChoice: byline,
      acknowledged: true,
    },
    noMeta,
  );
}

describe("acceptance opens the work approval", () => {
  it("moves the article on and fixes the licence from the contract", async () => {
    const { editor, article } = await scenario();

    const accepted = await toAwaitingRights(editor, article.id);
    expect(accepted.status).toBe("awaiting_rights");

    const approval = await findLiveApproval(article.id);
    expect(approval?.status).toBe("pending");

    // §7.1: the scope is the contract's, not a per-work form
    expect(approval?.grantType).toBe(LICENCE_TERMS.grantType);
    expect(approval?.grantType).toBe("non_exclusive_license");
    expect(approval?.rightReproduction).toBe(true);
    expect(approval?.rightDistribution).toBe(true);
    expect(approval?.rightCommunicationToPublic).toBe(true);
    expect(approval?.rightAdaptation).toBe(true);
    expect(approval?.channels).toEqual(["web", "pdf_issue", "social", "newsletter"]);
    expect(approval?.territory).toBe("worldwide");
    expect(approval?.exclusivityMonths).toBeNull();
    expect(approval?.consideration).toBe("none");
    expect(approval?.commercialUseIncluded).toBe(false);

    // and it records which contract version it rests on
    expect(approval?.agreementVersionId).not.toBeNull();
  });

  it("tells the writer an approval is waiting", async () => {
    const { editor, writerRow, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    expect(mailbox.lastTo(writerRow.email)?.subject).toContain("Eser Onayı bekliyor");
  });

  it("refuses to open one when no contract version is published", async () => {
    const editor = await createUser({ role: "editor" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const article = await createArticle(
      actorOf(editor),
      { title: "Sözleşmesiz", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );

    await transitionArticle(actorOf(editor), article.id, "in_review", noMeta);
    const error = await captureError(
      transitionArticle(actorOf(editor), article.id, "accepted", noMeta),
    );
    expect(error.status).toBe(409);
  });
});

describe("no publication without an approval", () => {
  it("refuses to schedule while the approval is pending, with 409", async () => {
    const { editor, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const error = await captureError(transitionArticle(editor, article.id, "scheduled", noMeta));

    expect(error.status).toBe(409);
    expect(error.message).toMatch(/İmzalanmış hak devri formu|Eser Onayı/i);

    const unchanged = await db.select().from(articles).where(eq(articles.id, article.id));
    expect(unchanged[0]!.status).toBe("awaiting_rights");
  });

  it("schedules and publishes once the writer approves", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const approved = await approveAsWriter(writer, article.id);

    expect(approved.status).toBe("signed");
    expect(approved.signedIp).toBe(noMeta.ip);
    expect(approved.signedUserAgent).toBe(noMeta.userAgent);
    expect(approved.bylineChoice).toBe("real_name");
    expect(approved.formPdfMediaId).not.toBeNull();

    const scheduled = await transitionArticle(editor, article.id, "scheduled", noMeta);
    expect(scheduled.status).toBe("scheduled");

    const published = await transitionArticle(editor, article.id, "published", noMeta);
    expect(published.status).toBe("published");
  });

  it("records the hash of the text that was actually approved", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const approved = await approveAsWriter(writer, article.id);
    expect(approved.formTextHash).toBe(articleHash(article.bodyMarkdown));
  });

  it("refuses an approval whose hash does not match the current text", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const approval = await findLiveApproval(article.id);

    const error = await captureError(
      approveWork(
        writer,
        {
          grantId: approval!.id,
          articleHash: "0".repeat(64),
          bylineChoice: "real_name",
          acknowledged: true,
        },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });

  it("does not let anyone but the writer approve", async () => {
    const { editor, admin, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const error = await captureError(approveAsWriter(admin, article.id));
    expect(error.status).toBe(403);
  });

  it("refuses a pen name byline when the writer has no pen name", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const error = await captureError(approveAsWriter(writer, article.id, "pen_name"));
    expect(error.status).toBe(400);
  });
});

describe("declining an approval", () => {
  it("sends the article back for revision", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const approval = await findLiveApproval(article.id);

    const updated = await declineWorkAndReturnForRevision(
      writer,
      { grantId: approval!.id, reason: "Sosyal medya mecrasını kabul etmiyorum." },
      noMeta,
    );

    expect(updated.status).toBe("revision_requested");

    const rows = await db.select().from(rightsGrants).where(eq(rightsGrants.id, approval!.id));
    expect(rows[0]!.status).toBe("declined");
  });

  it("requires a reason of at least ten characters", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const approval = await findLiveApproval(article.id);

    const error = await captureError(
      declineWorkAndReturnForRevision(writer, { grantId: approval!.id, reason: "kısa" }, noMeta),
    );
    expect(error.status).toBe(400);
  });
});

describe("a changed text needs a new approval (§7.5)", () => {
  it("keeps the approval when the editor calls it a correction", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);

    await updateArticle(
      editor,
      article.id,
      {
        title: article.title,
        bodyMarkdown: "# Başlık\n\nGövde metni, virgülü düzeltilmiş.",
        authorId: article.authorId,
        changeKind: "correction",
      },
      noMeta,
    );

    const approval = await findLiveApproval(article.id);
    expect(approval?.status).toBe("signed");
  });

  it("revokes it and opens a new one when the content changed", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const first = await approveAsWriter(writer, article.id);

    await updateArticle(
      editor,
      article.id,
      {
        title: article.title,
        bodyMarkdown: "# Başlık\n\nBambaşka bir gövde, anlamı değişmiş.",
        authorId: article.authorId,
        changeKind: "content_change",
      },
      noMeta,
    );

    const previous = await db.select().from(rightsGrants).where(eq(rightsGrants.id, first.id));
    expect(previous[0]!.status).toBe("revoked");

    const live = await findLiveApproval(article.id);
    expect(live?.status).toBe("pending");
    expect(live?.id).not.toBe(first.id);
  });

  it("takes a scheduled article back to waiting", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);
    await transitionArticle(editor, article.id, "scheduled", noMeta);

    const updated = await updateArticle(
      editor,
      article.id,
      {
        title: article.title,
        bodyMarkdown: "# Başlık\n\nYayın planı öncesi büyük değişiklik.",
        authorId: article.authorId,
        changeKind: "content_change",
      },
      noMeta,
    );

    expect(updated.status).toBe("awaiting_rights");
  });

  it("refuses to rewrite a published work in place", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    await transitionArticle(editor, article.id, "published", noMeta);

    const error = await captureError(
      updateArticle(
        editor,
        article.id,
        {
          title: article.title,
          bodyMarkdown: "# Başlık\n\nYayındayken değiştirilmiş metin.",
          authorId: article.authorId,
          changeKind: "content_change",
        },
        noMeta,
      ),
    );

    expect(error.status).toBe(409);
    expect(error.message).toMatch(/geri çekin/i);
  });
});

describe("media licensing guard", () => {
  it("refuses to schedule an article that uses media with no license", async () => {
    const { editor, writer, article } = await scenario();

    const [unlicensed] = await db
      .insert(media)
      .values({ storageKey: "media/x.png", mime: "image/png", size: 100, licenseType: null })
      .returning();
    await db.insert(articleMedia).values({ articleId: article.id, mediaId: unlicensed!.id });

    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);

    const error = await captureError(transitionArticle(editor, article.id, "scheduled", noMeta));
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/lisans/i);
  });

  it("refuses to attach unlicensed media through the service at all", async () => {
    const { editor, article } = await scenario();
    const [unlicensed] = await db
      .insert(media)
      .values({ storageKey: "media/y.png", mime: "image/png", size: 100, licenseType: null })
      .returning();

    const error = await captureError(attachMediaToArticle(editor, article.id, unlicensed!.id));
    expect(error.status).toBe(400);
  });
});

describe("withdrawal", () => {
  it("requires a reason and then answers 410 from the public API", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    const published = await transitionArticle(editor, article.id, "published", noMeta);

    const readable = await getPublicArticle(published.slug);
    expect(readable.title).toBe("Kayıp Zamanın İzinde");

    const withoutReason = await captureError(
      transitionArticle(editor, article.id, "withdrawn", noMeta),
    );
    expect(withoutReason.status).toBe(409);

    await transitionArticle(editor, article.id, "withdrawn", noMeta, {
      withdrawnReason: "Telif itirazı geldi.",
    });

    const error = await captureError(getPublicArticle(published.slug));
    expect(error.status).toBe(410);
  });

  it("hides an unpublished article behind a 404 rather than a 410", async () => {
    const { article } = await scenario();
    const error = await captureError(getPublicArticle(article.slug));
    expect(error.status).toBe(404);
  });
});

describe("scheduled publication job", () => {
  it("publishes what is due and leaves the rest alone", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);

    const future = new Date(Date.now() + 3_600_000);
    await transitionArticle(editor, article.id, "scheduled", noMeta, { scheduledAt: future });

    expect(await publishScheduledArticles(new Date())).toEqual([]);
    expect(await publishScheduledArticles(new Date(Date.now() + 7_200_000))).toEqual([
      article.slug,
    ]);
  });
});

describe("public issue listing", () => {
  it("returns published articles in their configured order", async () => {
    const { editor, writer, article } = await scenario();

    const issue = await createIssue(
      editor,
      { number: 1, title: "İlk Sayı", theme: "Başlangıçlar" },
      noMeta,
    );
    await db
      .update(articles)
      .set({ issueId: issue.id, orderInIssue: 1 })
      .where(eq(articles.id, article.id));

    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    await transitionArticle(editor, article.id, "published", noMeta);
    await setIssueStatus(editor, issue.id, "published", noMeta);

    const published = await getPublishedIssue(1);
    expect(published.articles).toHaveLength(1);
    expect(published.articles[0]!.slug).toBe(article.slug);
  });

  it("never exposes an author's e-mail or birth date", async () => {
    const { editor, writer, writerRow, article } = await scenario();
    await db
      .update(users)
      .set({ penName: "Mahlas", penNameSlug: "mahlas" })
      .where(eq(users.id, writerRow.id));

    await toAwaitingRights(editor, article.id);
    await approveAsWriter(writer, article.id);
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    const published = await transitionArticle(editor, article.id, "published", noMeta);

    const payload = JSON.stringify(await getPublicArticle(published.slug));
    expect(payload).not.toContain(writerRow.email);
    expect(payload).not.toContain("1995-05-05");
    expect(payload).toContain("Mahlas");
  });
});

describe("a new contract version", () => {
  it("does not lock active writers anymore (D-050)", async () => {
    const { admin, writerRow } = await scenario();

    let current = await db.select().from(users).where(eq(users.id, writerRow.id));
    expect(current[0]!.writerStatus).toBe("active");

    // A second version needs a different template text, so the file is swapped
    const { setAgreementTemplateForTests, readAgreementTemplate } = await import(
      "@/lib/agreement/template"
    );
    const original = readAgreementTemplate();
    setAgreementTemplateForTests(`${original}\n\n<!-- ikinci sürüm -->`);

    try {
      const draft = await createVersionFromTemplate(admin, noMeta);
      await publishAgreementVersion(admin, draft.id, noMeta);
    } finally {
      setAgreementTemplateForTests(null);
    }

    current = await db.select().from(users).where(eq(users.id, writerRow.id));
    expect(current[0]!.writerStatus).toBe("active");
  });

  it("refuses a version whose template is already on file", async () => {
    const { admin } = await scenario();
    const error = await captureError(createVersionFromTemplate(admin, noMeta));
    expect(error.status).toBe(409);
  });
});
