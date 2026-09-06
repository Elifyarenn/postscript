/**
 * The editorial lifecycle end to end (§7.2, §8, §10).
 *
 * These are the scenarios the specification lists as acceptance criteria:
 * acceptance opens a rights grant, an unsigned grant blocks scheduling with a
 * 409, unlicensed media blocks it too, a withdrawn article answers 410, and a
 * new agreement version knocks every active writer back to pending.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import { articles, media, rightsGrants, users } from "@/db/schema";
import { acceptAgreement, createAgreementDraft, publishAgreementVersion } from "@/services/agreements";
import {
  createArticle,
  declineRightsGrantAndReturnForRevision,
  publishScheduledArticles,
  transitionArticle,
} from "@/services/articles";
import { attachMediaToArticle } from "@/services/media";
import { createIssue, setIssueStatus } from "@/services/issues";
import { getPublicArticle, getPublishedIssue } from "@/services/public";
import { findActiveGrant, renderGrantForWriter, signRightsGrant } from "@/services/rights";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta } from "../helpers/factories";
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

/** An editor, a writer, and an article assigned to that writer. */
async function scenario() {
  const admin = await createUser({ role: "admin" });
  const editor = await createUser({ role: "editor" });
  const writer = await createUser({ role: "writer", writerStatus: "active" });

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
    writer: actorOf(writer),
    writerRow: writer,
    article,
  };
}

/** Walks an article from draft to awaiting_rights, which is where §7.2 begins. */
async function toAwaitingRights(editor: Actor, articleId: string) {
  await transitionArticle(editor, articleId, "in_review", noMeta);
  return transitionArticle(editor, articleId, "accepted", noMeta);
}

describe("acceptance creates the rights grant", () => {
  it("moves the article to awaiting_rights and opens a pending form", async () => {
    const { editor, article } = await scenario();

    const accepted = await toAwaitingRights(editor, article.id);

    // §7.2: acceptance is not a resting state, the article moves on by itself
    expect(accepted.status).toBe("awaiting_rights");

    const grant = await findActiveGrant(article.id);
    expect(grant?.status).toBe("pending");
    // The defaults from the form template
    expect(grant?.grantType).toBe("exclusive_license");
    expect(grant?.rightAdaptation).toBe(true);
    expect(grant?.rightReproduction).toBe(true);
    expect(grant?.rightDistribution).toBe(true);
    expect(grant?.rightCommunicationToPublic).toBe(true);
    expect(grant?.channels).toEqual(["web", "pdf_issue", "social", "newsletter"]);
    expect(grant?.exclusivityMonths).toBe(12);
    expect(grant?.commercialUseIncluded).toBe(false);
    expect(grant?.consideration).toBe("none");
  });

  it("tells the writer a form is waiting", async () => {
    const { editor, writerRow, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    expect(mailbox.lastTo(writerRow.email)?.subject).toContain("Hak devri formu bekliyor");
  });

  it("lists each transferred right on its own line in the form text", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);

    const rendered = await renderGrantForWriter(writer, grant!.id);

    // FSEK art. 52: the rights have to be named one by one
    expect(rendered.formText).toContain("İşleme hakkı (FSEK m.21)");
    expect(rendered.formText).toContain("Çoğaltma hakkı (FSEK m.22)");
    expect(rendered.formText).toContain("Yayma hakkı (FSEK m.23)");
    expect(rendered.formText).toContain("Umuma iletim hakkı (FSEK m.25)");
    expect(rendered.formText).toContain("Bedel: Yok");
    expect(rendered.formText).toContain("Ticari kullanım: Dahil değil");
  });
});

describe("no publication without a signature", () => {
  it("refuses to schedule while the form is unsigned, with 409", async () => {
    const { editor, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const error = await captureError(transitionArticle(editor, article.id, "scheduled", noMeta));

    expect(error.status).toBe(409);
    expect(error.message).toMatch(/İmzalanmış hak devri formu/);

    const unchanged = await db.select().from(articles).where(eq(articles.id, article.id));
    expect(unchanged[0]!.status).toBe("awaiting_rights");
  });

  it("schedules and publishes once the writer signs", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);

    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);

    const signed = await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );

    expect(signed.status).toBe("signed");
    expect(signed.signedIp).toBe(noMeta.ip);
    expect(signed.signedUserAgent).toBe(noMeta.userAgent);
    expect(signed.formPdfMediaId).not.toBeNull();

    const scheduled = await transitionArticle(editor, article.id, "scheduled", noMeta);
    expect(scheduled.status).toBe("scheduled");

    const published = await transitionArticle(editor, article.id, "published", noMeta);
    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
  });

  it("does not let anyone but the writer sign", async () => {
    const { editor, admin, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(editor, grant!.id);

    const error = await captureError(
      signRightsGrant(
        admin,
        { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
        noMeta,
      ),
    );
    expect(error.status).toBe(403);
  });

  it("refuses a signature whose hash does not match the stored form", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);

    const error = await captureError(
      signRightsGrant(
        writer,
        { grantId: grant!.id, formTextHash: "0".repeat(64), acknowledged: true },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });
});

describe("declining a form", () => {
  it("sends the article back for revision", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);

    const updated = await declineRightsGrantAndReturnForRevision(
      writer,
      { grantId: grant!.id, reason: "Sosyal medya mecrasını kabul etmiyorum." },
      noMeta,
    );

    expect(updated.status).toBe("revision_requested");

    const rows = await db.select().from(rightsGrants).where(eq(rightsGrants.id, grant!.id));
    expect(rows[0]!.status).toBe("declined");
    expect(rows[0]!.declinedReason).toContain("Sosyal medya");
  });
});

describe("media licensing guard", () => {
  it("refuses to schedule an article that uses media with no license", async () => {
    const { editor, writer, article } = await scenario();

    // A media row inserted without a license type, as an import might leave it
    const [unlicensed] = await db
      .insert(media)
      .values({ storageKey: "media/x.png", mime: "image/png", size: 100, licenseType: null })
      .returning();

    await db
      .insert(await import("@/db/schema").then((m) => m.articleMedia))
      .values({ articleId: article.id, mediaId: unlicensed!.id });

    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);
    await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );

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

    const error = await captureError(
      attachMediaToArticle(editor, article.id, unlicensed!.id),
    );
    expect(error.status).toBe(400);
  });
});

describe("withdrawal", () => {
  it("requires a reason and then answers 410 from the public API", async () => {
    const { editor, writer, article } = await scenario();
    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);
    await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    const published = await transitionArticle(editor, article.id, "published", noMeta);

    // While published it is readable
    const readable = await getPublicArticle(published.slug);
    expect(readable.title).toBe("Kayıp Zamanın İzinde");
    expect(readable.html).toContain("<h1>");

    const withoutReason = await captureError(
      transitionArticle(editor, article.id, "withdrawn", noMeta),
    );
    expect(withoutReason.status).toBe(409);

    await transitionArticle(editor, article.id, "withdrawn", noMeta, {
      withdrawnReason: "Telif itirazı geldi.",
    });

    const error = await captureError(getPublicArticle(published.slug));
    expect(error.status).toBe(410);

    // The row itself is kept, not deleted
    const rows = await db.select().from(articles).where(eq(articles.id, article.id));
    expect(rows[0]!.withdrawnReason).toBe("Telif itirazı geldi.");
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
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);
    await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );

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

    await db.update(articles).set({ issueId: issue.id, orderInIssue: 1 }).where(eq(articles.id, article.id));

    await toAwaitingRights(editor, article.id);
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);
    await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );
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
    const grant = await findActiveGrant(article.id);
    const rendered = await renderGrantForWriter(writer, grant!.id);
    await signRightsGrant(
      writer,
      { grantId: grant!.id, formTextHash: rendered.formTextHash, acknowledged: true },
      noMeta,
    );
    await transitionArticle(editor, article.id, "scheduled", noMeta);
    const published = await transitionArticle(editor, article.id, "published", noMeta);

    const payload = JSON.stringify(await getPublicArticle(published.slug));
    expect(payload).not.toContain(writerRow.email);
    expect(payload).not.toContain("1995-05-05");
    expect(payload).toContain("Mahlas");
  });
});

describe("a new agreement version", () => {
  it("knocks active writers back to pending_agreement until they accept it", async () => {
    const { admin, writer, writerRow } = await scenario();

    const draftOne = await createAgreementDraft(
      admin,
      {
        title: "postscript Çerçeve Sözleşmesi",
        bodyMarkdown: "Bu sözleşme yazar ile dergi arasındaki çerçeveyi belirler. ".repeat(5),
      },
      noMeta,
    );
    await publishAgreementVersion(admin, draftOne.id, noMeta);

    // Publishing pushes every active writer back to pending
    let current = await db.select().from(users).where(eq(users.id, writerRow.id));
    expect(current[0]!.writerStatus).toBe("pending_agreement");

    const published = await db
      .select()
      .from(await import("@/db/schema").then((m) => m.agreementVersions))
      .limit(1);

    await acceptAgreement(
      { ...writer, writerStatus: "pending_agreement" },
      {
        agreementVersionId: published[0]!.id,
        bodyHash: published[0]!.bodyHash,
        acknowledged: true,
      },
      noMeta,
    );

    current = await db.select().from(users).where(eq(users.id, writerRow.id));
    expect(current[0]!.writerStatus).toBe("active");

    // A second version repeats the cycle
    const draftTwo = await createAgreementDraft(
      admin,
      {
        title: "postscript Çerçeve Sözleşmesi",
        bodyMarkdown: "Güncellenmiş çerçeve sözleşme metni buradadır. ".repeat(5),
      },
      noMeta,
    );
    await publishAgreementVersion(admin, draftTwo.id, noMeta);

    current = await db.select().from(users).where(eq(users.id, writerRow.id));
    expect(current[0]!.writerStatus).toBe("pending_agreement");
  });

  it("refuses to edit a version that is already published", async () => {
    const { admin } = await scenario();
    const draft = await createAgreementDraft(
      admin,
      { title: "Sözleşme", bodyMarkdown: "Yeterince uzun bir sözleşme metni. ".repeat(5) },
      noMeta,
    );
    await publishAgreementVersion(admin, draft.id, noMeta);

    const { updateAgreementDraft } = await import("@/services/agreements");
    const error = await captureError(
      updateAgreementDraft(
        admin,
        draft.id,
        { title: "Değişti", bodyMarkdown: "Başka bir metin. ".repeat(10) },
        noMeta,
      ),
    );
    expect(error.status).toBe(409);
  });
});
