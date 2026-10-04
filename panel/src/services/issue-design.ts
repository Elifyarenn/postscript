import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditLog, issuePageHotspots, issuePages, issueQuizzes, issues, media } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { designFor } from "@/lib/issue-design";
import {
  designKeyOf,
  designLabel,
  designOrder,
  designStorageKey,
  manifestProblems,
  renderListSchema,
  type DesignArea,
  type DesignManifest,
  type RenderRecord,
} from "@/lib/issue-design/manifest";
import { PAGE_VARIANT_WIDTHS, variantName } from "@/lib/issue-page-variants";
import { getStorage } from "@/lib/storage";
import type { RequestMeta } from "./auth";
import { createQuiz, updateQuiz } from "./issue-quizzes";
import {
  addIssuePage,
  addPageImage,
  replacePageImage,
  reorderIssuePages,
  saveHotspots,
  updateIssuePage,
  updatePageMeta,
} from "./issue-pages";

/**
 * The designers' pages, imported from code (D-274).
 *
 * `src/lib/issue-design/issue-01.ts` lists the pages; the pictures are drawn
 * from the delivered Illustrator files by `scripts/render-issue-design.ts` and
 * travel with the deployment under `assets/issue-design/`. This service runs
 * on the server that owns the bucket — never from a laptop, because a script
 * run against production with a local `.env` writes the rows to production and
 * the files to the laptop's disk, which is how D-240's test pages broke
 * (D-247, D-257).
 *
 * It goes through the ordinary page machinery (`addPageImage`,
 * `replacePageImage`, `saveHotspots`), so a designed page is an ordinary page
 * afterwards and the panel can still edit it.
 *
 * Order of work, so a failure never leaves the admins without a preview:
 *
 *  1. every picture is stored and read back; only a byte-for-byte match counts
 *  2. the manifest's quizzes are written (D-297) and the pages that lay them
 *     out (D-309), then titles, contents entries and areas are set
 *  3. only then are the issue's other pages (the temporary preview, the test
 *     and template pages) saved to a snapshot and taken out; the snapshot is
 *     written and read back first, and their pictures are left in place, so
 *     `restoreIssueDesignSnapshot` can put them back exactly
 *  4. the pages take the manifest's order
 *
 * Running it again changes only what changed: an unchanged picture has the
 * same content-derived storage key and is not uploaded again, a changed one
 * gets a new key and the old file is released, a page taken out of the
 * manifest leaves the issue.
 */

export type DesignDeps = {
  manifestFor: (issueNumber: number) => DesignManifest | null;
  readRenders: (folder: string) => RenderRecord[];
  readAsset: (folder: string, file: string) => Buffer;
};

const ASSETS = () => path.join(process.cwd(), "assets", "issue-design");

const defaultDeps: DesignDeps = {
  manifestFor: designFor,
  readRenders: (folder) =>
    renderListSchema.parse(JSON.parse(readFileSync(path.join(ASSETS(), folder, "renders.json"), "utf8"))),
  // The folder and file come from the manifest, never from a request
  readAsset: (folder, file) => readFileSync(path.join(ASSETS(), folder, file)),
};

export type DesignImportResult = {
  issueNumber: number;
  pages: number;
  added: number;
  replaced: number;
  unchanged: number;
  /** Design pages that are no longer in the manifest. */
  dropped: number;
  /** Earlier pages taken out into a snapshot. */
  retired: number;
};

const RETIRED_ACTION = "issue_design.previous_pages_retired";
const RESTORED_ACTION = "issue_design.previous_pages_restored";

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function snapshotKey(issueId: string, snapshotId: string): string {
  return `issue-pages/snapshots/${issueId}/${snapshotId}.json`;
}

async function adminIssue(actor: Actor, issueId: string) {
  if (!canAccessAdminPanel(actor)) throw forbidden("Tasarım aktarımı yalnızca yöneticilerindir.");
  const [issue] = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt)))
    .limit(1);
  if (!issue) throw notFound("Sayı bulunamadı.");
  // Only the admins' working issue: nothing here may put pages where the
  // team or readers could open them before the admins decide (D-240)
  if (!issue.adminOnly) {
    throw badRequest("Tasarım aktarımı yalnızca “yalnızca yöneticiler” olarak işaretli örnek sayıya yapılır.");
  }
  return issue;
}

/** The issue's pages with the storage key of their picture. */
async function pagesWithKeys(issueId: string) {
  return db
    .select({
      id: issuePages.id,
      label: issuePages.label,
      position: issuePages.position,
      imageMediaId: issuePages.imageMediaId,
      storageKey: media.storageKey,
      mediaDeleted: media.deletedAt,
    })
    .from(issuePages)
    .leftJoin(media, eq(issuePages.imageMediaId, media.id))
    .where(eq(issuePages.issueId, issueId))
    .orderBy(asc(issuePages.position));
}

/**
 * A design picture that nothing uses any more is released: the row is marked
 * deleted and the file removed. Only files this service wrote are touched.
 */
async function releaseDesignMedia(mediaId: string, actor: Actor, meta: RequestMeta): Promise<void> {
  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row || row.deletedAt || !row.storageKey.startsWith("issue-pages/design/")) return;

  const [pageUse] = await db
    .select({ id: issuePages.id })
    .from(issuePages)
    .where(sql`${issuePages.imageMediaId} = ${mediaId} or ${issuePages.blocks}::text like ${`%${mediaId}%`}`)
    .limit(1);
  const [areaUse] = await db
    .select({ id: issuePageHotspots.id })
    .from(issuePageHotspots)
    .where(eq(issuePageHotspots.infoMediaId, mediaId))
    .limit(1);
  if (pageUse || areaUse) return;

  // Another row may name the same content-derived key; the file stays for it
  const [sameKey] = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.storageKey, row.storageKey), isNull(media.deletedAt), sql`${media.id} <> ${mediaId}`))
    .limit(1);

  await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, mediaId));
  if (!sameKey) {
    await getStorage()
      .remove({ bucket: "media", key: row.storageKey })
      .catch(() => undefined);
  }
  await writeAudit({
    actorId: actor.id,
    action: "issue_design.media_released",
    entityType: "media",
    entityId: mediaId,
    ip: meta.ip,
  });
}

/** Reads a stored object back; the import counts nothing it cannot read. */
async function assertStored(key: string, expected: string, what: string): Promise<void> {
  const body = await getStorage()
    .get({ bucket: "media", key })
    .catch(() => null);
  if (!body || sha256(body) !== expected) {
    throw badRequest(`${what} depolamaya yazıldı ama geri okunamadı; eski sayfalar yerinde bırakıldı. Tekrar deneyin.`);
  }
}

function areaInput(area: DesignArea, pageIds: Map<string, string>, quizIds: Map<string, string>) {
  const [x, y, w, h] = area.rect;
  const base = { name: area.name, ariaLabel: area.name, showMarker: area.showMarker ?? false, x, y, w, h };
  switch (area.kind) {
    case "page":
      return { ...base, kind: "page" as const, targetPageId: pageIds.get(area.target) };
    case "link":
      return { ...base, kind: "link" as const, url: area.url, openInNewTab: true };
    case "info":
      return { ...base, kind: "info" as const, infoTitle: area.title, infoBody: area.body };
    case "quiz":
      return { ...base, kind: "quiz" as const, quizId: quizIds.get(area.quizTitle) };
  }
}

export async function importIssueDesign(
  actor: Actor,
  issueId: string,
  meta: RequestMeta,
  deps: DesignDeps = defaultDeps,
): Promise<DesignImportResult> {
  const issue = await adminIssue(actor, issueId);
  const manifest = deps.manifestFor(issue.number);
  if (!manifest) throw badRequest(`Sayı ${issue.number} için kodda tanımlı bir tasarım yok.`);

  /* ---- Everything is checked before anything is written ---- */
  const renders = deps.readRenders(manifest.folder);
  const problems = manifestProblems(manifest, renders);
  if (problems.length) throw badRequest(problems.join(" "));

  const pictures = new Map<string, { buffer: Buffer; sha: string; file: string }>();
  for (const page of manifest.pages) {
    const record = renders.find((row) => row.key === page.key)!;
    const buffer = deps.readAsset(manifest.folder, record.file);
    const sha = sha256(buffer);
    if (sha !== record.sha256) {
      throw badRequest(`"${page.key}" görsel dosyası renders.json kaydıyla uyuşmuyor: görseli yeniden üretin.`);
    }
    pictures.set(page.key, { buffer, sha, file: record.file });
  }

  const wantedQuizzes = [
    ...new Set(manifest.pages.flatMap((page) => page.areas.flatMap((area) => (area.kind === "quiz" ? [area.quizTitle] : [])))),
  ];
  const ownQuizzes = manifest.quizzes ?? [];
  const quizTitles = [...new Set([...wantedQuizzes, ...ownQuizzes.map((quiz) => quiz.title)])];
  const quizIds = new Map<string, string>();
  if (quizTitles.length) {
    const rows = await db
      .select({ id: issueQuizzes.id, title: issueQuizzes.title })
      .from(issueQuizzes)
      .where(and(eq(issueQuizzes.issueId, issue.id), inArray(issueQuizzes.title, quizTitles)));
    for (const row of rows) quizIds.set(row.title, row.id);
    // A quiz the manifest carries itself is written below; any other must be there already
    const missing = wantedQuizzes.filter(
      (title) => !quizIds.has(title) && !ownQuizzes.some((quiz) => quiz.title === title),
    );
    if (missing.length) throw badRequest(`Manifestteki test bu sayıda yok: ${missing.map((t) => `“${t}”`).join(", ")}.`);
  }

  /* ---- 1. Pictures: stored, read back, attached ---- */
  const before = await pagesWithKeys(issue.id);
  const byKey = new Map<string, (typeof before)[number]>();
  for (const row of before) {
    const key = designKeyOf(row.label);
    if (key && !byKey.has(key)) byKey.set(key, row);
  }

  const pageIds = new Map<string, string>();
  let added = 0;
  let replaced = 0;
  let unchanged = 0;

  for (const page of manifest.pages) {
    const picture = pictures.get(page.key)!;
    const storageKey = designStorageKey(manifest.folder, page.key, picture.sha);
    const found = byKey.get(page.key);
    const input = { buffer: picture.buffer, fileName: picture.file, declaredMime: "image/webp", storageKey };

    if (found && found.storageKey === storageKey && !found.mediaDeleted) {
      await assertStored(storageKey, picture.sha, `“${page.title}”`).catch(async () => {
        // The row is right but the file is gone: put the same bytes back
        await getStorage().put({ bucket: "media", key: storageKey, body: picture.buffer, mime: "image/webp" });
        await assertStored(storageKey, picture.sha, `“${page.title}”`);
      });
      unchanged += 1;
      pageIds.set(page.key, found.id);
    } else if (found) {
      await replacePageImage(actor, found.id, input, meta);
      await assertStored(storageKey, picture.sha, `“${page.title}”`);
      if (found.imageMediaId) await releaseDesignMedia(found.imageMediaId, actor, meta);
      replaced += 1;
      pageIds.set(page.key, found.id);
    } else {
      const created = await addPageImage(
        actor,
        issue.id,
        { ...input, label: designLabel(page.key, page.title) },
        meta,
      );
      await assertStored(storageKey, picture.sha, `“${page.title}”`);
      added += 1;
      pageIds.set(page.key, created.id);
    }
  }

  // The smaller copies a phone reads (D-313), next to each original. Not read
  // back: a missing copy only means the reader is given the original
  for (const page of manifest.pages) {
    const picture = pictures.get(page.key)!;
    const storageKey = designStorageKey(manifest.folder, page.key, picture.sha);
    for (const width of PAGE_VARIANT_WIDTHS) {
      const file = variantName(picture.file, width);
      const key = variantName(storageKey, width);
      if (!file || !key) continue;
      let body: Buffer;
      try {
        body = deps.readAsset(manifest.folder, file);
      } catch {
        continue;
      }
      if (!body?.length) continue;
      await getStorage().put({ bucket: "media", key, body, mime: "image/webp" });
    }
  }

  /* ---- 2. The manifest's quizzes, then what each page is, and its areas ---- */
  for (const quiz of ownQuizzes) {
    const existing = quizIds.get(quiz.title);
    if (existing) await updateQuiz(actor, existing, quiz, meta);
    else quizIds.set(quiz.title, await createQuiz(actor, issue.id, quiz, meta));
  }

  // A test page has no picture: it is a page that lays its quiz out (D-309),
  // found again by the key in its label like every design page
  for (const quizPage of manifest.quizPages ?? []) {
    const content = {
      template: "interactive",
      heading: quizPage.quizTitle,
      section: quizPage.section,
      tocTitle: quizPage.contents,
      inContents: quizPage.contents !== null,
      blocks: [{ kind: "test", quizId: quizIds.get(quizPage.quizTitle)! }],
    };
    const found = byKey.get(quizPage.key);
    let pageId: string;
    if (found) {
      await updateIssuePage(actor, found.id, content, meta);
      // Only if this key was once a picture: the picture is no longer the page
      if (found.imageMediaId) await releaseDesignMedia(found.imageMediaId, actor, meta);
      unchanged += 1;
      pageId = found.id;
    } else {
      pageId = await addIssuePage(actor, issue.id, content, meta);
      added += 1;
    }
    await updatePageMeta(
      actor,
      pageId,
      {
        label: designLabel(quizPage.key, quizPage.title),
        imageAlt: null,
        transcript: null,
        tocTitle: quizPage.contents,
        inContents: quizPage.contents !== null,
      },
      meta,
    );
    pageIds.set(quizPage.key, pageId);
  }

  for (const page of manifest.pages) {
    const pageId = pageIds.get(page.key)!;
    await updatePageMeta(
      actor,
      pageId,
      {
        label: designLabel(page.key, page.title),
        imageAlt: page.alt,
        transcript: page.transcript,
        tocTitle: page.contents,
        inContents: page.contents !== null,
        template: page.role === "page" ? "full_bleed" : page.role,
      },
      meta,
    );
    // The manifest is the whole set: a rerun replaces the areas, never adds
    await saveHotspots(
      actor,
      pageId,
      page.areas.map((area) => areaInput(area, pageIds, quizIds)),
      meta,
    );
  }

  /* ---- 3. The rest of the issue: dropped design pages, retired older pages ---- */
  const kept = new Set(pageIds.values());
  const others = (await pagesWithKeys(issue.id)).filter((row) => !kept.has(row.id));
  const stale = others.filter((row) => designKeyOf(row.label) !== null);
  const older = others.filter((row) => designKeyOf(row.label) === null);

  for (const row of stale) {
    await db.delete(issuePages).where(eq(issuePages.id, row.id));
    if (row.imageMediaId) await releaseDesignMedia(row.imageMediaId, actor, meta);
  }

  if (older.length) {
    const snapshotId = randomUUID();
    const ids = older.map((row) => row.id);
    const snapshot = {
      version: 1,
      issueId: issue.id,
      issueNumber: issue.number,
      takenAt: new Date().toISOString(),
      pages: await db.select().from(issuePages).where(inArray(issuePages.id, ids)).orderBy(asc(issuePages.position)),
      hotspots: await db
        .select()
        .from(issuePageHotspots)
        .where(inArray(issuePageHotspots.pageId, ids))
        .orderBy(asc(issuePageHotspots.position)),
    };
    const body = Buffer.from(JSON.stringify(snapshot), "utf8");
    const key = snapshotKey(issue.id, snapshotId);
    await getStorage().put({ bucket: "media", key, body, mime: "application/json" });
    await assertStored(key, sha256(body), "Eski sayfaların yedeği");

    // Only after the snapshot is safely stored. Their pictures stay put.
    await db.delete(issuePages).where(inArray(issuePages.id, ids));
    await writeAudit({
      actorId: actor.id,
      action: RETIRED_ACTION,
      entityType: "issues",
      entityId: issue.id,
      after: { snapshotId, pageIds: ids, count: ids.length },
      ip: meta.ip,
    });
  }

  /* ---- 4. The manifest's order ---- */
  const order = designOrder(manifest);
  await reorderIssuePages(
    actor,
    issue.id,
    order.map((key) => pageIds.get(key)!),
    meta,
  );

  const result: DesignImportResult = {
    issueNumber: issue.number,
    pages: order.length,
    added,
    replaced,
    unchanged,
    dropped: stale.length,
    retired: older.length,
  };
  await writeAudit({
    actorId: actor.id,
    action: "issue_design.imported",
    entityType: "issues",
    entityId: issue.id,
    after: result,
    ip: meta.ip,
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* Undo                                                                */
/* ------------------------------------------------------------------ */

const snapshotSchema = z.object({
  version: z.literal(1),
  issueId: z.uuid(),
  pages: z.array(z.record(z.string(), z.unknown())),
  hotspots: z.array(z.record(z.string(), z.unknown())),
});

/** The latest retirement of this issue that has not been undone yet, if any. */
export async function pendingSnapshot(issueId: string): Promise<{ snapshotId: string; count: number; at: Date } | null> {
  const [latest] = await db
    .select({ after: auditLog.after, createdAt: auditLog.createdAt })
    .from(auditLog)
    .where(and(eq(auditLog.action, RETIRED_ACTION), eq(auditLog.entityType, "issues"), eq(auditLog.entityId, issueId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  const after = latest?.after as { snapshotId?: string; count?: number } | undefined;
  if (!latest || !after?.snapshotId) return null;

  const restored = await db
    .select({ after: auditLog.after })
    .from(auditLog)
    .where(and(eq(auditLog.action, RESTORED_ACTION), eq(auditLog.entityType, "issues"), eq(auditLog.entityId, issueId)));
  if (restored.some((row) => (row.after as { snapshotId?: string } | null)?.snapshotId === after.snapshotId)) {
    return null;
  }
  return { snapshotId: after.snapshotId, count: after.count ?? 0, at: latest.createdAt };
}

/** A stored date comes back from JSON as a string. */
function asDate(value: unknown): Date | null {
  return typeof value === "string" || value instanceof Date ? new Date(value) : null;
}

/**
 * Puts back the pages the last import took out, with their own ids, pictures
 * and areas, and takes the design pages out. Nothing is lost by the second
 * half: the design pages are made again from code by the next import.
 */
export async function restoreIssueDesignSnapshot(
  actor: Actor,
  issueId: string,
  meta: RequestMeta,
): Promise<{ restored: number; removed: number }> {
  const issue = await adminIssue(actor, issueId);
  const pending = await pendingSnapshot(issue.id);
  if (!pending) throw badRequest("Geri alınacak bir tasarım aktarımı yok.");

  const raw = await getStorage().get({ bucket: "media", key: snapshotKey(issue.id, pending.snapshotId) });
  const snapshot = snapshotSchema.parse(JSON.parse(raw.toString("utf8")));
  if (snapshot.issueId !== issue.id) throw badRequest("Yedek bu sayıya ait değil.");

  // The pictures and quizzes the snapshot names, as they are now
  const mediaIds = new Set(
    [
      ...snapshot.pages.map((page) => page.imageMediaId),
      ...snapshot.hotspots.map((area) => area.infoMediaId),
    ].filter((id): id is string => typeof id === "string"),
  );
  const liveMedia = new Set(
    mediaIds.size
      ? (await db.select({ id: media.id }).from(media).where(inArray(media.id, [...mediaIds]))).map((row) => row.id)
      : [],
  );
  const liveQuizzes = new Set(
    (await db.select({ id: issueQuizzes.id }).from(issueQuizzes).where(eq(issueQuizzes.issueId, issue.id))).map(
      (row) => row.id,
    ),
  );

  const current = await pagesWithKeys(issue.id);
  const design = current.filter((row) => designKeyOf(row.label) !== null);
  const rest = current.filter((row) => designKeyOf(row.label) === null);

  for (const row of design) {
    await db.delete(issuePages).where(eq(issuePages.id, row.id));
    if (row.imageMediaId) await releaseDesignMedia(row.imageMediaId, actor, meta);
  }

  // Out of the way of the unique (issue, position) index; the order is set below
  const offset = 20_000;
  const restoredIds: string[] = [];
  for (const [index, page] of snapshot.pages.entries()) {
    const id = String(page.id);
    await db.insert(issuePages).values({
      ...(page as unknown as typeof issuePages.$inferInsert),
      id,
      issueId: issue.id,
      position: offset + index,
      imageMediaId: liveMedia.has(String(page.imageMediaId)) ? String(page.imageMediaId) : null,
      createdAt: asDate(page.createdAt) ?? new Date(),
      updatedAt: new Date(),
    });
    restoredIds.push(id);
  }
  const back = new Set(restoredIds);
  for (const area of snapshot.hotspots) {
    await db.insert(issuePageHotspots).values({
      ...(area as unknown as typeof issuePageHotspots.$inferInsert),
      targetPageId: back.has(String(area.targetPageId)) ? String(area.targetPageId) : null,
      quizId: liveQuizzes.has(String(area.quizId)) ? String(area.quizId) : null,
      infoMediaId: liveMedia.has(String(area.infoMediaId)) ? String(area.infoMediaId) : null,
      createdAt: asDate(area.createdAt) ?? new Date(),
      updatedAt: new Date(),
    });
  }

  await reorderIssuePages(actor, issue.id, [...restoredIds, ...rest.map((row) => row.id)], meta);
  await writeAudit({
    actorId: actor.id,
    action: RESTORED_ACTION,
    entityType: "issues",
    entityId: issue.id,
    after: { snapshotId: pending.snapshotId, restored: restoredIds.length, removed: design.length },
    ip: meta.ip,
  });
  return { restored: restoredIds.length, removed: design.length };
}
