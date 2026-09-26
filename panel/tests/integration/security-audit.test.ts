/**
 * Security regressions from the 2026-09-24 audit (D-248).
 *
 * Most integration tests call services with a hand-built actor. These go one
 * level further where it matters: the media route and a server action are
 * called directly, with a real session cookie, the way an attacker would call
 * them — skipping every button the UI hides. `next/headers` is replaced by a
 * cookie jar so the real session, CSRF and role code runs unchanged.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, type Database } from "@/db/client";
import {
  agreementAcceptances,
  articles,
  media,
  posts,
  sessions,
  users,
  type User,
} from "@/db/schema";
import { MemoryMailAdapter, setMailAdapter } from "@/lib/mail/transport";
import { MemoryStorageAdapter, setStorageAdapter } from "@/lib/storage";
import { isAppError } from "@/lib/errors";
import { csvCell } from "@/lib/csv";
import { renderMarkdown } from "@/lib/markdown";
import { createSession, getAuthContext, revokeSession } from "@/lib/auth/session";
import { attachMediaToArticle, listMedia, updateMediaLicense } from "@/services/media";
import { acceptAgreement, getCurrentAgreement, renderAgreementForWriter } from "@/services/agreements";
import {
  createArticle,
  createArticleAsWriter,
  setPlagiarismStatus,
  transitionArticle,
  updateArticle,
  updateArticleAsWriter,
} from "@/services/articles";
import { articleHash, findLiveApproval } from "@/services/rights";
import { changeRole, updateProfile } from "@/services/users";
import { deleteOwnPost } from "@/services/posts";
import { getPublicAuthor } from "@/services/public";
import { GET as getMediaRoute } from "@/app/api/media/[id]/route";
import { updateMediaLicenseAction } from "@/app/editor/actions";
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
  reloadUser,
} from "../helpers/factories";

/* ------------------------------------------------------------------ */
/* A request context without Next: a cookie jar and request headers    */
/* ------------------------------------------------------------------ */

const jar = vi.hoisted(() => ({ cookies: new Map<string, string>(), headers: new Headers() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.cookies.has(name) ? { name, value: jar.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.cookies.set(name, value),
    delete: (name: string) => void jar.cookies.delete(name),
  }),
  headers: async () => jar.headers,
}));
// revalidatePath needs Next's request store; nothing here renders a page
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

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
  signOut();
});

function signOut(): void {
  jar.cookies.clear();
  jar.headers = new Headers();
}

/** Opens a real session for the user; the jar now carries its cookie. */
async function signIn(user: User): Promise<string> {
  signOut();
  return createSession({ userId: user.id, ip: noMeta.ip, userAgent: noMeta.userAgent });
}

/** Editors and admins need the second factor on file to pass `requireRole`. */
async function withTotp(user: User): Promise<User> {
  await db.update(users).set({ totpEnabledAt: new Date() }).where(eq(users.id, user.id));
  return reloadUser(user.id);
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return isAppError(error) ? error : null;
  }
}

async function fetchMedia(id: string): Promise<Response> {
  return getMediaRoute(new Request(`http://localhost:3001/api/media/${id}`), {
    params: Promise.resolve({ id }),
  });
}

/** An admin, a published contract and a writer who has signed it. */
async function contractScenario() {
  const admin = await createUser({ role: "admin" });
  await publishContract(actorOf(admin));

  const writer = await createUser({ role: "writer", writerStatus: "active" });
  await acceptCurrentContract(writer);

  const [acceptance] = await db
    .select({ pdfMediaId: agreementAcceptances.pdfMediaId })
    .from(agreementAcceptances)
    .where(and(eq(agreementAcceptances.userId, writer.id), isNotNull(agreementAcceptances.pdfMediaId)));

  const editor = await withTotp(await createUser({ role: "editor", editorStatus: "active" }));
  return { admin, writer, editor, contractId: acceptance!.pdfMediaId! };
}

/* ------------------------------------------------------------------ */
/* Contract PDFs are not editor material                               */
/* ------------------------------------------------------------------ */

describe("contract PDFs and the media library", () => {
  it("keeps contracts out of the editor's library listing", async () => {
    const { editor, contractId } = await contractScenario();

    const library = await listMedia(actorOf(editor), 500);
    expect(library.map((row) => row.id)).not.toContain(contractId);
  });

  it("refuses to relabel a contract, and leaves its label as it was", async () => {
    const { editor, contractId } = await contractScenario();

    const error = await captureError(
      updateMediaLicense(actorOf(editor), contractId, { licenseType: "other" }, noMeta),
    );
    expect(error?.status).toBe(404);

    const [row] = await db.select().from(media).where(eq(media.id, contractId));
    expect(row!.licenseType).toBe("contract_pdf");
  });

  it("does not let an editor stamp library media as a contract", async () => {
    const { editor } = await contractScenario();
    const [own] = await db
      .insert(media)
      .values({ storageKey: "media/2026-09-24/x.png", mime: "image/png", size: 1, licenseType: "own_work" })
      .returning();

    const error = await captureError(
      updateMediaLicense(actorOf(editor), own!.id, { licenseType: "contract_pdf" }, noMeta),
    );
    expect(error?.status).toBe(400);
  });

  it("refuses to attach a contract to an article", async () => {
    const { admin, writer, editor, contractId } = await contractScenario();
    const article = await createArticle(
      actorOf(admin),
      { title: "Ek Denemesi", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );

    const error = await captureError(attachMediaToArticle(actorOf(editor), article.id, contractId));
    expect(error?.status).toBe(404);
  });

  it("GET /api/media/:id: an editor gets 403 on a contract, even one relabelled before the fix", async () => {
    const { editor, contractId } = await contractScenario();

    await signIn(editor);
    expect((await fetchMedia(contractId)).status).toBe(403);

    // A relabel that happened before D-248 must not reopen the door
    await db.update(media).set({ licenseType: "other" }).where(eq(media.id, contractId));
    expect((await fetchMedia(contractId)).status).toBe(403);
  });

  it("GET /api/media/:id: the writer who signed it and the admin still get it", async () => {
    const { admin, writer, contractId } = await contractScenario();

    await signIn(writer);
    const own = await fetchMedia(contractId);
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toContain("no-store");

    await signIn(admin);
    expect((await fetchMedia(contractId)).status).toBe(200);
  });

  it("GET /api/media/:id: another writer gets 403, and no session gets 401", async () => {
    const { contractId } = await contractScenario();
    const other = await createUser({ role: "writer", writerStatus: "active" });

    await signIn(other);
    expect((await fetchMedia(contractId)).status).toBe(403);

    signOut();
    expect((await fetchMedia(contractId)).status).toBe(401);
  });

  it("GET /api/media/:id: an application sample is the admin's, not the editors'", async () => {
    const { admin, editor } = await contractScenario();
    const [sample] = await db
      .insert(media)
      .values({ storageKey: "writer-applications/2026-09-24/s.pdf", mime: "application/pdf", size: 5 })
      .returning();
    await storage.put({ bucket: "media", key: sample!.storageKey, body: Buffer.from("%PDF-"), mime: "application/pdf" });

    await signIn(editor);
    expect((await fetchMedia(sample!.id)).status).toBe(403);

    await signIn(admin);
    expect((await fetchMedia(sample!.id)).status).toBe(200);
  });

  it("the server action, called directly with a valid CSRF token, still refuses", async () => {
    const { editor, contractId } = await contractScenario();
    const reader = await createUser();

    const post = (fields: Record<string, string>) => {
      const form = new FormData();
      form.set("csrfToken", "csrf-token-for-tests");
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      return updateMediaLicenseAction(null, form);
    };
    const asCaller = async (user: User) => {
      await signIn(user);
      jar.cookies.set("ps_csrf", "csrf-token-for-tests");
      jar.headers = new Headers({ origin: "http://localhost:3001" });
    };

    // A plain reader has no editor role at all
    await asCaller(reader);
    expect((await post({ mediaId: contractId, licenseType: "other" }))?.error).toBeTruthy();

    // An editor has the role, but the row is a contract
    await asCaller(editor);
    expect((await post({ mediaId: contractId, licenseType: "other" }))?.error).toContain("bulunamadı");

    const [row] = await db.select().from(media).where(eq(media.id, contractId));
    expect(row!.licenseType).toBe("contract_pdf");
  });
});

/* ------------------------------------------------------------------ */
/* A frozen writer stays frozen                                        */
/* ------------------------------------------------------------------ */

describe("accepting the contract", () => {
  async function accept(writer: User) {
    const current = await getCurrentAgreement();
    const preview = await renderAgreementForWriter(writer);
    await acceptAgreement(
      actorOf(writer),
      { agreementVersionId: current!.id, renderedHash: preview.hash, acknowledged: true },
      noMeta,
    );
  }

  it("records a frozen writer's acceptance but does not lift the freeze", async () => {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const writer = await createUser({ role: "writer", writerStatus: "suspended" });

    await accept(writer);

    expect((await reloadUser(writer.id)).writerStatus).toBe("suspended");
    const recorded = await db
      .select()
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, writer.id));
    expect(recorded).toHaveLength(1);
  });

  it("still activates a writer who was waiting for the contract", async () => {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const writer = await createUser({ role: "writer", writerStatus: "pending_agreement" });

    await accept(writer);

    expect((await reloadUser(writer.id)).writerStatus).toBe("active");
  });
});

/* ------------------------------------------------------------------ */
/* An approval always names the text and the author it covers         */
/* ------------------------------------------------------------------ */

describe("work approvals follow the text and the author", () => {
  async function chain() {
    const admin = await createUser({ role: "admin" });
    await publishContract(actorOf(admin));
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db.update(users).set({ writerArea: "Sanat & Edebiyat" }).where(eq(users.id, writer.id));
    const author = await reloadUser(writer.id);
    await acceptCurrentContract(author);

    const draft = await createArticleAsWriter(
      actorOf(author),
      { title: "Onay Zinciri", bodyMarkdown: "İlk gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );
    await transitionArticle(actorOf(author), draft.id, "in_review", noMeta, {});
    return { admin: actorOf(admin), author, draftId: draft.id };
  }

  it("drops the author's declaration when they rewrite the body", async () => {
    const { admin, author, draftId } = await chain();
    expect((await findLiveApproval(draftId))?.status).toBe("signed");

    await transitionArticle(admin, draftId, "revision_requested", noMeta, { note: "Kısaltın." });
    await updateArticleAsWriter(
      actorOf(author),
      draftId,
      { title: "Onay Zinciri", bodyMarkdown: "Yeni gövde.", category: "Sanat & Edebiyat" },
      noMeta,
    );

    // The old declaration named "İlk gövde."; it must not travel on
    expect(await findLiveApproval(draftId)).toBeNull();

    // Moved on by the reviewers without a resubmit: acceptance asks the author again
    await transitionArticle(admin, draftId, "in_review", noMeta, {});
    await transitionArticle(admin, draftId, "pending_admin_approval", noMeta, {});
    await transitionArticle(admin, draftId, "ready_for_publishing", noMeta, {});
    await transitionArticle(admin, draftId, "accepted", noMeta, {});

    const live = await findLiveApproval(draftId);
    expect(live?.status).toBe("pending");
    expect(live?.formTextHash).toBe(articleHash("Yeni gövde."));
  });

  it("reopens the approval for the new author when an editor changes the author", async () => {
    const { admin, draftId } = await chain();
    const other = await createUser({ role: "writer", writerStatus: "active" });

    await updateArticle(admin, draftId, { title: "Onay Zinciri", authorId: other.id }, noMeta);

    const live = await findLiveApproval(draftId);
    expect(live?.status).toBe("pending");
    expect(live?.grantorId).toBe(other.id);
  });

  it("refuses an author change or a content change on a published work before writing anything", async () => {
    const { admin, author, draftId } = await chain();
    await db
      .update(articles)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(articles.id, draftId));
    const other = await createUser({ role: "writer", writerStatus: "active" });

    const authorError = await captureError(
      updateArticle(admin, draftId, { title: "Onay Zinciri", authorId: other.id }, noMeta),
    );
    expect(authorError?.status).toBe(409);

    const bodyError = await captureError(
      updateArticle(
        admin,
        draftId,
        { title: "Onay Zinciri", bodyMarkdown: "Sessizce değişen gövde.", changeKind: "content_change" },
        noMeta,
      ),
    );
    expect(bodyError?.status).toBe(409);

    // The refusal used to come after the write; the page on the site had changed
    const [row] = await db.select().from(articles).where(eq(articles.id, draftId));
    expect(row!.authorId).toBe(author.id);
    expect(row!.bodyMarkdown).toBe("İlk gövde.");
  });
});

/* ------------------------------------------------------------------ */
/* The audit's minimum scenarios on the service layer                  */
/* ------------------------------------------------------------------ */

describe("one member against another", () => {
  it("cannot revoke another member's session", async () => {
    const alice = await createUser();
    const bob = await createUser();
    await signIn(bob);
    const bobSession = (await getAuthContext())!.sessionId;

    await revokeSession(alice.id, bobSession);

    const [row] = await db.select().from(sessions).where(eq(sessions.id, bobSession));
    expect(row!.revokedAt).toBeNull();
  });

  it("cannot delete another member's post", async () => {
    const alice = await createUser();
    const bob = await createUser();
    const [post] = await db.insert(posts).values({ authorId: bob.id, body: "Bob'un gönderisi" }).returning();

    const error = await captureError(deleteOwnPost(actorOf(alice), post!.id));
    expect(error?.status).toBe(404);

    const [row] = await db.select().from(posts).where(eq(posts.id, post!.id));
    expect(row!.deletedAt).toBeNull();
  });

  it("cannot raise their own role through the profile form", async () => {
    const reader = await createUser();

    const error = await captureError(
      updateProfile(actorOf(reader), { displayName: "Okur Kişi", role: "admin" }, noMeta),
    );
    expect(error?.status).toBe(400);
    expect((await reloadUser(reader.id)).role).toBe("user");
  });

  it("cannot call the admin's role change", async () => {
    const reader = await createUser();
    const target = await createUser();

    const error = await captureError(changeRole(actorOf(reader), target.id, "admin", noMeta));
    expect(error?.status).toBe(403);
    expect((await reloadUser(target.id)).role).toBe("user");
  });

  it("cannot store a javascript: or data: link as a social link", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });

    for (const link of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      const error = await captureError(
        updateProfile(actorOf(writer), { displayName: "Yazar Kişi", socialLinks: { x: link } }, noMeta),
      );
      expect(error?.status).toBe(400);
    }
  });
});

describe("sessions that should no longer work", () => {
  it("rejects a revoked session and an expired one", async () => {
    const reader = await createUser();

    await signIn(reader);
    const { sessionId } = (await getAuthContext())!;
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
    expect(await getAuthContext()).toBeNull();

    await signIn(reader);
    const second = (await getAuthContext())!.sessionId;
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, second));
    expect(await getAuthContext()).toBeNull();
  });

  it("rejects a cookie nobody issued", async () => {
    signOut();
    jar.cookies.set("ps_session", "forged-token-value");
    expect(await getAuthContext()).toBeNull();
  });
});

describe("untrusted text on the way out", () => {
  it("strips scripts, handlers and javascript: links from markdown", async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[tıkla](javascript:alert(1))',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("neutralises spreadsheet formulas in CSV cells", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("Ada Yazar")).toBe(`"Ada Yazar"`);
    expect(csvCell(null)).toBe(`""`);
  });
});

describe("the 2026-09-26 launch audit (D-253, D-255)", () => {
  it("keeps members' profile photos out of the editor's library", async () => {
    const editor = await createUser({ role: "editor" });
    const [photo] = await db
      .insert(media)
      .values({ storageKey: "profile/avatar/2026-09-26/x.png", mime: "image/png", size: 1, licenseType: "own_work" })
      .returning();

    const library = await listMedia(actorOf(editor), 500);
    expect(library.map((row) => row.id)).not.toContain(photo!.id);

    const error = await captureError(
      updateMediaLicense(actorOf(editor), photo!.id, { licenseType: "other" }, noMeta),
    );
    expect(error?.status).toBe(404);
  });

  it("gives a banned author no public page and never returns a javascript: link", async () => {
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    await db
      .update(users)
      .set({
        penNameSlug: "ada-yazar",
        socialLinks: { x: "javascript:alert(1)", instagram: "https://instagram.com/ada" },
      })
      .where(eq(users.id, writer.id));

    const author = await getPublicAuthor("ada-yazar");
    expect(author.socialLinks).toEqual({ instagram: "https://instagram.com/ada" });

    await db.update(users).set({ isBanned: true }).where(eq(users.id, writer.id));
    const error = await captureError(getPublicAuthor("ada-yazar"));
    expect(error?.status).toBe(404);
  });

  it("refuses an unknown plagiarism status with a 400, not a database error", async () => {
    const admin = await createUser({ role: "admin" });
    const writer = await createUser({ role: "writer", writerStatus: "active" });
    const article = await createArticle(
      actorOf(admin),
      { title: "İntihal Denemesi", bodyMarkdown: "Gövde.", authorId: writer.id },
      noMeta,
    );

    const error = await captureError(
      setPlagiarismStatus(actorOf(admin), article.id, "bogus" as "clean", null, noMeta),
    );
    expect(error?.status).toBe(400);
  });
});
