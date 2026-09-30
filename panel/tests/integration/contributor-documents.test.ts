/**
 * Preparing the contributors' documents (D-276): one contract per account and
 * version, one licence form per work on its author's account, nothing guessed,
 * nothing sent, no work touched — and only the owner and an admin can read them.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  agreementVersions,
  articles,
  contributorDocuments,
  mailJobs,
  rightsGrants,
  users,
  type User,
} from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { getCurrentAgreement, publishAgreementVersion } from "@/services/agreements";
import {
  contributorDocumentPdf,
  listContributorDocuments,
  listOwnContributorDocuments,
  prepareContributorDocuments,
  viewContributorDocument,
} from "@/services/contributor-documents";
import { articleHash } from "@/services/rights";
import { ADAPTATION_SCOPE_TEXT, LICENCE_DURATION_TEXT } from "@/lib/contributor-documents";
import { GET as getPdfRoute } from "@/app/api/contributor-documents/[id]/pdf/route";
import { resetTables, setupTestDatabase, teardownTestDatabase } from "../helpers/db";
import { actorOf, createUser, noMeta, publishContract, testIssueId } from "../helpers/factories";

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () => jar.headers,
}));

let database: Database;
const mailbox = new MemoryMailAdapter();

beforeAll(async () => {
  database = await setupTestDatabase();
  setMailAdapter(mailbox);
});

afterAll(async () => {
  await teardownTestDatabase();
});

beforeEach(async () => {
  await resetTables(database);
  mailbox.clear();
  jar.cookies.clear();
});

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
}

const BODY = "Birinci paragraf, yazarın kendi cümleleriyle.\n\nİkinci paragraf da öyle.";

async function work(author: User, status: (typeof articles.$inferInsert)["status"], title: string) {
  const [row] = await db
    .insert(articles)
    .values({ issueId: await testIssueId(), title, slug: title.toLowerCase().replace(/\W+/g, "-"), status, authorId: author.id, bodyMarkdown: BODY })
    .returning();
  return row!;
}

async function scenario() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));

  const complete = await createUser({ role: "writer", writerStatus: "active", displayName: "Tam Kayıt" });
  await db.update(users).set({ penName: "Mahlas" }).where(eq(users.id, complete.id));
  const noBirthDate = await createUser({ role: "writer", writerStatus: "active", birthDate: null });
  const illustrator = await createUser({ role: "user", isIllustrator: true });
  const editor = await createUser({ role: "editor" }); // wrote nothing: not a contributor
  const reader = await createUser(); // not a contributor
  const gone = await createUser({ role: "writer" });
  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, gone.id));

  const published = await work(complete, "published", "Yayımlanmış Yazı");
  const draft = await work(complete, "draft", "Taslak Yazı");
  const accepted = await work(noBirthDate, "accepted", "Kabul Edilmiş Yazı");
  const orphan = await work(gone, "published", "Silinmiş Hesabın Yazısı");
  await db.insert(rightsGrants).values({
    articleId: published.id,
    grantorId: complete.id,
    grantType: "non_exclusive_license",
    formTextHash: articleHash(BODY),
    status: "signed",
    signedAt: new Date(),
    bylineChoice: "pen_name",
  });

  return { admin, complete, noBirthDate, illustrator, editor, reader, gone, published, draft, accepted, orphan };
}

describe("preparing", () => {
  it("makes one contract per contributor and one licence per work, on the right account", async () => {
    const s = await scenario();
    const summary = await prepareContributorDocuments(actorOf(s.admin), noMeta);

    expect(summary.generalCreated).toBe(3);
    expect(summary.licenceCreated).toBe(3);
    expect(summary.skipped).toEqual([
      { reason: "Hesap silinmiş: genel sözleşme hazırlanmadı", count: 1 },
      { reason: "Eserin sahibinin hesabı silinmiş: ruhsat hazırlanmadı", count: 1 },
    ]);

    const rows = await db.select().from(contributorDocuments);
    const general = rows.filter((row) => row.kind === "general_agreement");
    expect(general.map((row) => row.userId).sort()).toEqual([s.complete.id, s.noBirthDate.id, s.illustrator.id].sort());
    expect(rows.some((row) => row.userId === s.editor.id || row.userId === s.reader.id)).toBe(false);

    const licence = rows.find((row) => row.articleId === s.published.id)!;
    expect(licence.userId).toBe(s.complete.id);
    expect(licence.workContentHash).toBe(articleHash(BODY));
    expect(rows.find((row) => row.articleId === s.accepted.id)!.userId).toBe(s.noBirthDate.id);
  });

  it("fills a complete contract, and keeps an incomplete one for review with its reason", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const rows = await db.select().from(contributorDocuments).where(eq(contributorDocuments.kind, "general_agreement"));
    const of = (user: User) => rows.find((row) => row.userId === user.id)!;

    expect(of(s.complete).status).toBe("prepared");
    expect(of(s.complete).renderedMarkdown).toContain("Katkı Sağlayan / Eser Sahibi: Tam Kayıt");
    expect(of(s.complete).renderedMarkdown).toContain("Rol / katkı türü: Yazar");
    expect(of(s.complete).renderedMarkdown).not.toMatch(/\{\{/);
    expect(of(s.illustrator).renderedMarkdown).toContain("Rol / katkı türü: Çizer");

    expect(of(s.noBirthDate).status).toBe("needs_review");
    expect(of(s.noBirthDate).reviewReasons).toEqual(["Doğum tarihi kayıtlı değil"]);
    expect(of(s.noBirthDate).renderedMarkdown).toBeNull();
  });

  it("fills the fixed period and adaptation limit, and does not guess a byline or an unaccepted work", async () => {
    const s = await scenario();
    const summary = await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const rows = await db.select().from(contributorDocuments).where(eq(contributorDocuments.kind, "work_licence"));
    const of = (id: string) => rows.find((row) => row.articleId === id)!;

    for (const row of rows) {
      expect(row.reviewReasons).not.toContain("Ruhsat süresi sistemde tanımlı değil");
      expect(row.reviewReasons).not.toContain("İşleme hakkının yazılı kapsamı sistemde tanımlı değil");
    }
    // The signed approval recorded a byline for this one, so nothing is left to review
    const ready = of(s.published.id);
    expect(ready.status).toBe("prepared");
    expect(ready.renderedMarkdown).toContain(LICENCE_DURATION_TEXT);
    expect(ready.renderedMarkdown).toContain(ADAPTATION_SCOPE_TEXT);
    expect(ready.renderedMarkdown).toContain("Mahlasıyla (Mahlas)");
    expect(ready.renderedMarkdown).not.toMatch(/\{\{/);

    // The others have no choice on record, and none is guessed
    expect(of(s.accepted.id).status).toBe("needs_review");
    expect(of(s.accepted.id).reviewReasons).toContain("Bu eser için yayın adı tercihi (gerçek ad / mahlas) kayıtlı değil");
    expect(of(s.accepted.id).reviewReasons).toContain("Doğum tarihi kayıtlı değil");
    expect(of(s.draft.id).reviewReasons).toContain("Bu eser için yayın adı tercihi (gerçek ad / mahlas) kayıtlı değil");
    expect(of(s.draft.id).reviewReasons).toContain("Eser henüz Dergi tarafından kabul edilmedi (durum: draft)");

    expect(summary.needsReview.total).toBe(3);
    expect(summary.needsReview.reasons["Bu eser için yayın adı tercihi (gerçek ad / mahlas) kayıtlı değil"]).toBe(2);
  });

  it("sends nothing and changes no work, author or approval", async () => {
    const s = await scenario();
    const before = {
      works: await db.select().from(articles),
      grants: await db.select().from(rightsGrants),
      people: await db.select().from(users),
    };

    await prepareContributorDocuments(actorOf(s.admin), noMeta);

    expect(mailbox.outbox).toHaveLength(0);
    expect(await db.select().from(mailJobs)).toHaveLength(0);
    expect(await db.select().from(articles)).toEqual(before.works);
    expect(await db.select().from(rightsGrants)).toEqual(before.grants);
    expect(await db.select().from(users)).toEqual(before.people);
  });

  it("makes no duplicate when run again, and resolves a document once its data is fixed", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const first = await db.select().from(contributorDocuments);

    const again = await prepareContributorDocuments(actorOf(s.admin), noMeta);
    expect(again.generalCreated).toBe(0);
    expect(again.licenceCreated).toBe(0);
    expect(again.alreadyPrepared.general).toBe(2);
    expect(await db.select().from(contributorDocuments)).toHaveLength(first.length);

    await db.update(users).set({ birthDate: "1990-01-01" }).where(eq(users.id, s.noBirthDate.id));
    const fixed = await prepareContributorDocuments(actorOf(s.admin), noMeta);
    expect(fixed.resolved).toBe(1);
    const rows = await db.select().from(contributorDocuments);
    expect(rows).toHaveLength(first.length);
    const contract = rows.find((row) => row.kind === "general_agreement" && row.userId === s.noBirthDate.id)!;
    expect(contract.status).toBe("prepared");
    expect(contract.id).toBe(first.find((row) => row.id === contract.id)!.id);
  });

  it("keeps a contract for review when the current version is not the contributor contract", async () => {
    const s = await scenario();
    const current = (await getCurrentAgreement())!;
    const [other] = await db
      .insert(agreementVersions)
      .values({ version: current.version + 1, title: "Başka metin", bodyMarkdown: "Başka bir sözleşme: {{katki.ad_soyad}}", bodyHash: "e".repeat(64) })
      .returning();
    await publishAgreementVersion(actorOf(s.admin), other!.id, noMeta);

    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const [contract] = await db
      .select()
      .from(contributorDocuments)
      .where(eq(contributorDocuments.userId, s.complete.id));
    expect(contract!.status).toBe("needs_review");
    expect(contract!.reviewReasons[0]).toMatch(/Genel Katkı Sağlayan Sözleşmesi metni değil/);
  });

  it("is the admin's alone", async () => {
    const s = await scenario();
    for (const actor of [actorOf(s.complete), actorOf(s.editor)]) {
      expect((await captureError(prepareContributorDocuments(actor, noMeta)))?.status).toBe(403);
      expect((await captureError(listContributorDocuments(actor)))?.status).toBe(403);
    }
    expect(await db.select().from(contributorDocuments)).toHaveLength(0);
  });
});

describe("the admin reading one person's document (D-278)", () => {
  it("shows a prepared document exactly as stored", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const [licence] = await db
      .select()
      .from(contributorDocuments)
      .where(eq(contributorDocuments.articleId, s.published.id));

    const view = await viewContributorDocument(actorOf(s.admin), licence!.id);
    expect(view.isPreview).toBe(false);
    expect(view.markdown).toBe(licence!.renderedMarkdown);
    expect(view.item.userName).toBe("Tam Kayıt");
    expect(view.item.articleTitle).toBe("Yayımlanmış Yazı");
  });

  it("previews a document under review with its gaps marked, and saves nothing", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const before = await db.select().from(contributorDocuments);
    const contract = before.find((row) => row.kind === "general_agreement" && row.userId === s.noBirthDate.id)!;
    const licence = before.find((row) => row.articleId === s.accepted.id)!;

    const general = await viewContributorDocument(actorOf(s.admin), contract.id);
    expect(general.isPreview).toBe(true);
    expect(general.markdown).toContain("**[EKSİK: Doğum tarihi kayıtlı değil]**");
    expect(general.markdown).not.toMatch(/\{\{/);

    const form = await viewContributorDocument(actorOf(s.admin), licence.id);
    expect(form.markdown).toContain("**[EKSİK: Bu eser için yayın adı tercihi (gerçek ad / mahlas) kayıtlı değil]**");
    expect(form.markdown).toContain("Kabul Edilmiş Yazı");
    expect(form.markdown).not.toMatch(/\{\{/);

    expect(await db.select().from(contributorDocuments)).toEqual(before);
  });

  it("is the admin's alone", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const own = (await listOwnContributorDocuments(actorOf(s.complete)))[0]!;
    for (const actor of [actorOf(s.complete), actorOf(s.editor)]) {
      expect((await captureError(viewContributorDocument(actor, own.id)))?.status).toBe(403);
    }
    expect((await captureError(viewContributorDocument(actorOf(s.admin), "not-a-uuid")))?.status).toBe(404);
  });
});

describe("reading and downloading", () => {
  it("shows a contributor only their own documents, and the admin all of them", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);

    const own = await listOwnContributorDocuments(actorOf(s.complete));
    expect(own.every((row) => row.userId === s.complete.id)).toBe(true);
    expect(own.map((row) => row.kind).sort()).toEqual(["general_agreement", "work_licence", "work_licence"]);
    expect(own.find((row) => row.articleId === s.published.id)!.articleTitle).toBe("Yayımlanmış Yazı");

    const all = await listContributorDocuments(actorOf(s.admin));
    expect(all).toHaveLength(6);
  });

  it("gives the PDF to its owner and an admin, and 'not found' to anyone else", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const [contract] = await db
      .select()
      .from(contributorDocuments)
      .where(eq(contributorDocuments.userId, s.complete.id));
    const id = contract!.kind === "general_agreement" ? contract!.id : (await listOwnContributorDocuments(actorOf(s.complete))).find((row) => row.kind === "general_agreement")!.id;

    const pdf = await contributorDocumentPdf(actorOf(s.complete), id);
    expect(pdf.body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    await contributorDocumentPdf(actorOf(s.admin), id);

    expect((await captureError(contributorDocumentPdf(actorOf(s.illustrator), id)))?.status).toBe(404);
    expect((await captureError(contributorDocumentPdf(actorOf(s.editor), id)))?.status).toBe(404);
    expect((await captureError(contributorDocumentPdf(actorOf(s.complete), "not-a-uuid")))?.status).toBe(404);

    // A document under review has no PDF yet
    const review = (await listOwnContributorDocuments(actorOf(s.complete))).find((row) => row.status === "needs_review")!;
    expect((await captureError(contributorDocumentPdf(actorOf(s.complete), review.id)))?.status).toBe(409);
  });

  it("GET /api/contributor-documents/:id/pdf follows the same rule", async () => {
    const s = await scenario();
    await prepareContributorDocuments(actorOf(s.admin), noMeta);
    const id = (await listOwnContributorDocuments(actorOf(s.complete))).find((row) => row.kind === "general_agreement")!.id;

    const fetchAs = async (user: User | null) => {
      jar.cookies.clear();
      if (user) await createSession({ userId: user.id, ip: noMeta.ip, userAgent: noMeta.userAgent });
      return getPdfRoute(new Request(`http://localhost/api/contributor-documents/${id}/pdf`), {
        params: Promise.resolve({ id }),
      });
    };

    const own = await fetchAs(s.complete);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("application/pdf");
    expect(own.headers.get("cache-control")).toBe("private, no-store");
    expect((await fetchAs(s.illustrator)).status).toBe(404);
    expect((await fetchAs(null)).status).toBe(401);
  });
});
