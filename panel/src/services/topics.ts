/**
 * Issue windows and topic proposals (D-261).
 *
 * The admin sets two windows on an issue; the clock does the rest. A writer
 * proposes one topic per issue while the topic window is open, the main
 * editor (or an admin) accepts it, asks for a change or turns it down, and the
 * writer's article for an accepted topic may be handed in while the delivery
 * window is open. Every rule is checked here, on the server, against the time
 * of the request; the pages only mirror it.
 */
import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  articles,
  issues,
  notifications,
  topicProposalEvents,
  topicProposals,
  users,
  type Article,
  type Issue,
  type TopicProposal,
  type TopicProposalStatus,
} from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import {
  canAccessAdminPanel,
  canProposeTopics,
  canReviewTopicProposals,
  type Actor,
} from "@/lib/auth/rbac";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import {
  formatPeriod,
  periodState,
  submissionPeriod,
  SUBMISSION_PERIOD_TEXT,
  topicPeriod,
  TOPIC_PERIOD_TEXT,
  usesIssueWindows,
  type PeriodState,
} from "@/lib/issue-periods";
import { getEditorAssignment, selectableWriterCategories } from "./editor-categories";
import type { RequestMeta } from "./auth";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Postgres' unique violation, however the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error; current && typeof current === "object"; ) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** An issue writers may see: not deleted and not the admins' working copy (D-240). */
async function writerVisibleIssue(issueId: string): Promise<Issue> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.id, issueId), isNull(issues.deletedAt), eq(issues.adminOnly, false)))
    .limit(1);
  const issue = rows[0];
  if (!issue) throw notFound("Sayı bulunamadı.");
  return issue;
}

function windowMessage(text: Record<PeriodState, string>, state: PeriodState, range: string | null) {
  return range ? `${text[state]} (${range}).` : `${text[state]}.`;
}

async function findProposal(proposalId: string): Promise<TopicProposal> {
  const rows = await db
    .select()
    .from(topicProposals)
    .where(and(eq(topicProposals.id, proposalId), isNull(topicProposals.deletedAt)))
    .limit(1);
  const proposal = rows[0];
  if (!proposal) throw notFound("Konu önerisi bulunamadı.");
  return proposal;
}

async function notifyAuthor(proposal: TopicProposal, title: string, body: string | null) {
  await db.insert(notifications).values({
    userId: proposal.authorId,
    kind: "editorial",
    title,
    body,
    href: "/writer/topics",
  });
}

/* ------------------------------------------------------------------ */
/* Writer: propose and revise                                          */
/* ------------------------------------------------------------------ */

export const topicInputSchema = z.strictObject({
  title: z.string().trim().min(3, "Konu başlığı en az 3 karakter olmalı.").max(200),
  description: z
    .string()
    .trim()
    .min(10, "Kısa bir açıklama yazın (en az 10 karakter).")
    .max(2000, "Açıklama en fazla 2000 karakter olabilir."),
  category: z.string().trim().max(80).optional().nullable(),
});

/** The category, when given, must be one of the writer's areas, as for articles. */
async function allowedCategory(actor: Actor, category: string | null | undefined) {
  const value = category?.trim() || null;
  if (!value) return null;
  const allowed = await selectableWriterCategories(actor);
  if (!allowed.includes(value)) {
    throw badRequest(`"${value}" alanı size tanımlı değil.`, { category: ["Alan size tanımlı değil."] });
  }
  return value;
}

export async function submitTopicProposal(
  actor: Actor,
  issueId: string,
  rawInput: unknown,
  meta: RequestMeta,
  now: Date = new Date(),
): Promise<TopicProposal> {
  if (!canProposeTopics(actor)) throw forbidden();

  const parsed = topicInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Konu bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const issue = await writerVisibleIssue(issueId);

  const state = periodState(topicPeriod(issue), now);
  if (state !== "open") {
    throw conflict(windowMessage(TOPIC_PERIOD_TEXT, state, formatPeriod(topicPeriod(issue))));
  }
  const category = await allowedCategory(actor, parsed.data.category);

  let proposal: TopicProposal;
  try {
    proposal = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(topicProposals)
        .values({
          issueId: issue.id,
          authorId: actor.id,
          title: parsed.data.title,
          description: parsed.data.description,
          category,
          status: "submitted",
          version: 1,
          submittedAt: now,
        })
        .returning();
      await tx.insert(topicProposalEvents).values({
        proposalId: row!.id,
        kind: "submitted",
        version: 1,
        title: row!.title,
        description: row!.description,
        category: row!.category,
        actorId: actor.id,
      });
      return row!;
    });
  } catch (error) {
    // The unique index, not a read-then-write, is what stops a double click
    // or a replayed request from making a second proposal
    if (isUniqueViolation(error)) throw conflict("Bu sayı için zaten bir konu öneriniz var.");
    throw error;
  }

  await writeAudit({
    actorId: actor.id,
    action: "topic.submitted",
    entityType: "topic_proposals",
    entityId: proposal.id,
    after: { issueNumber: issue.number, title: proposal.title },
    ip: meta.ip,
  });
  return proposal;
}

/**
 * Whether a proposal sent back for changes may still be sent again. A change
 * is asked for after the writer's own submission, often near the end of the
 * topic window, so it stays open until the delivery window closes; a new
 * proposal does not (D-261).
 */
export function mayResubmit(issue: Issue, now: Date): boolean {
  const topic = periodState(topicPeriod(issue), now);
  if (topic === "upcoming" || topic === "unset") return false;
  return periodState(submissionPeriod(issue), now) !== "closed";
}

export async function reviseTopicProposal(
  actor: Actor,
  proposalId: string,
  rawInput: unknown,
  expectedVersion: number,
  meta: RequestMeta,
  now: Date = new Date(),
): Promise<TopicProposal> {
  if (!canProposeTopics(actor)) throw forbidden();

  const proposal = await findProposal(proposalId);
  if (proposal.authorId !== actor.id) throw forbidden("Yalnızca kendi konunuzu düzenleyebilirsiniz.");
  if (proposal.status !== "revision_requested") {
    throw conflict("Bu konu şu anda düzenlenemez; yalnızca değişiklik istenen konu yeniden gönderilir.");
  }

  const parsed = topicInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Konu bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const issue = await writerVisibleIssue(proposal.issueId);
  if (!mayResubmit(issue, now)) {
    throw conflict("Bu sayının yazı kabul süresi doldu; konu artık yeniden gönderilemez.");
  }
  const category = await allowedCategory(actor, parsed.data.category);

  const updated = await db.transaction(async (tx) => {
    // Conditional on the version the writer saw, so a second tab or a replay
    // cannot resubmit twice or over a decision made in between
    const [row] = await tx
      .update(topicProposals)
      .set({
        title: parsed.data.title,
        description: parsed.data.description,
        category,
        status: "submitted",
        version: sql`${topicProposals.version} + 1`,
        submittedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(topicProposals.id, proposalId),
          eq(topicProposals.version, expectedVersion),
          eq(topicProposals.status, "revision_requested"),
        ),
      )
      .returning();
    if (!row) return null;
    await tx.insert(topicProposalEvents).values({
      proposalId: row.id,
      kind: "resubmitted",
      version: row.version,
      title: row.title,
      description: row.description,
      category: row.category,
      actorId: actor.id,
    });
    return row;
  });
  if (!updated) throw conflict("Konu bu arada değişti; sayfayı yenileyip tekrar deneyin.");

  await writeAudit({
    actorId: actor.id,
    action: "topic.resubmitted",
    entityType: "topic_proposals",
    entityId: proposalId,
    after: { version: updated.version, title: updated.title },
    ip: meta.ip,
  });
  return updated;
}

/* ------------------------------------------------------------------ */
/* Main editor: decide                                                 */
/* ------------------------------------------------------------------ */

export const topicDecisionSchema = z
  .strictObject({
    decision: z.enum(["accept", "revision", "reject"]),
    note: z.string().trim().max(2000, "Not en fazla 2000 karakter olabilir.").optional().nullable(),
    expectedVersion: z.number().int().positive(),
  })
  .refine((value) => value.decision === "accept" || Boolean(value.note?.trim()), {
    message: "Değişiklik isterken ya da reddederken yazara bir not yazmalısınız.",
    path: ["note"],
  });

const DECISION_STATUS = {
  accept: "accepted",
  revision: "revision_requested",
  reject: "rejected",
} as const satisfies Record<string, TopicProposalStatus>;

const DECISION_EVENT = {
  accept: "accepted",
  revision: "revision_requested",
  reject: "rejected",
} as const;

export async function decideTopicProposal(
  actor: Actor,
  proposalId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<TopicProposal> {
  const assignment = await getEditorAssignment(actor.id);
  if (!canReviewTopicProposals(actor, assignment)) {
    throw forbidden("Konu önerilerini yalnızca ana editör ve yöneticiler değerlendirir.");
  }

  const parsed = topicDecisionSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw badRequest("Karar geçersiz.", z.flattenError(parsed.error).fieldErrors);
  }
  const { decision, expectedVersion } = parsed.data;
  const note = parsed.data.note?.trim() || null;

  const proposal = await findProposal(proposalId);
  // A hybrid main editor also writes; nobody decides on their own topic
  if (proposal.authorId === actor.id) throw forbidden("Kendi konu önerinizi değerlendiremezsiniz.");
  if (proposal.status !== "submitted") {
    throw conflict("Bu öneri değerlendirme beklemiyor; sayfayı yenileyin.");
  }

  const now = new Date();
  const status = DECISION_STATUS[decision];

  const updated = await db.transaction(async (tx) => {
    // Two editors in two tabs: only the one whose version still matches wins
    const [row] = await tx
      .update(topicProposals)
      .set({
        status,
        editorNote: note,
        decidedBy: actor.id,
        decidedAt: now,
        version: sql`${topicProposals.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(topicProposals.id, proposalId),
          eq(topicProposals.version, expectedVersion),
          eq(topicProposals.status, "submitted"),
        ),
      )
      .returning();
    if (!row) return null;
    await tx.insert(topicProposalEvents).values({
      proposalId: row.id,
      kind: DECISION_EVENT[decision],
      version: row.version,
      title: row.title,
      description: row.description,
      category: row.category,
      note,
      actorId: actor.id,
    });
    return row;
  });
  if (!updated) {
    throw conflict("Bu öneri başka bir sekmede ya da başka bir editör tarafından güncellendi; sayfayı yenileyin.");
  }

  await writeAudit({
    actorId: actor.id,
    action: `topic.${DECISION_EVENT[decision]}`,
    entityType: "topic_proposals",
    entityId: proposalId,
    before: { status: proposal.status, version: proposal.version },
    after: { status, version: updated.version },
    ip: meta.ip,
  });

  const heading =
    decision === "accept"
      ? `Konunuz kabul edildi: ${updated.title}`
      : decision === "revision"
        ? `Konunuz için değişiklik istendi: ${updated.title}`
        : `Konunuz kabul edilmedi: ${updated.title}`;
  await notifyAuthor(updated, heading, note);

  return updated;
}

/* ------------------------------------------------------------------ */
/* Delivery: the article's side                                        */
/* ------------------------------------------------------------------ */

/**
 * Called by `transitionArticle` when an author hands in a draft
 * (`draft → in_review`). In an issue with windows the delivery window must
 * be open and the article must be the one written for the author's accepted
 * topic. An issue without windows keeps the old flow (issue 1).
 */
export async function assertArticleDeliveryAllowed(
  article: Pick<Article, "id" | "issueId" | "authorId">,
  now: Date = new Date(),
): Promise<void> {
  const rows = await db.select().from(issues).where(eq(issues.id, article.issueId)).limit(1);
  const issue = rows[0];
  if (!issue || issue.deletedAt) throw conflict("Yazının sayısı bulunamadı.");
  if (!usesIssueWindows(issue)) return;

  const state = periodState(submissionPeriod(issue), now);
  if (state !== "open") {
    throw conflict(windowMessage(SUBMISSION_PERIOD_TEXT, state, formatPeriod(submissionPeriod(issue))));
  }

  const topic = await db
    .select({ id: topicProposals.id })
    .from(topicProposals)
    .where(
      and(
        eq(topicProposals.articleId, article.id),
        eq(topicProposals.issueId, issue.id),
        eq(topicProposals.status, "accepted"),
        isNull(topicProposals.deletedAt),
      ),
    )
    .limit(1);
  if (topic.length === 0) {
    throw conflict("Bu yazının kabul edilmiş bir konusu yok; önce konunuzun onaylanması gerekiyor.");
  }
}

/**
 * For a writer creating an article: the accepted topic it is written for,
 * still without an article. Throws when the topic is not theirs, not accepted
 * or already has one.
 */
export async function acceptedTopicForNewArticle(actor: Actor, proposalId: string): Promise<TopicProposal> {
  const proposal = await findProposal(proposalId);
  if (proposal.authorId !== actor.id) throw forbidden("Bu konu size ait değil.");
  if (proposal.status !== "accepted") throw conflict("Yazı yalnızca kabul edilmiş bir konu için başlatılabilir.");
  if (proposal.articleId) throw conflict("Bu konunun yazısı zaten başlatıldı.");
  return proposal;
}

/** Issues writers may still start an article in without a topic: those without windows. */
export async function listIssuesWithoutWindows(): Promise<Issue[]> {
  return db
    .select()
    .from(issues)
    .where(
      and(
        isNull(issues.deletedAt),
        eq(issues.adminOnly, false),
        isNull(issues.topicOpensAt),
        isNull(issues.submissionOpensAt),
        inArray(issues.status, ["planning", "in_production"]),
      ),
    )
    .orderBy(desc(issues.number));
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export type ProposalEvent = typeof topicProposalEvents.$inferSelect & { actorName: string | null };

async function eventsFor(proposalIds: string[]): Promise<Map<string, ProposalEvent[]>> {
  const byProposal = new Map<string, ProposalEvent[]>();
  if (proposalIds.length === 0) return byProposal;
  const rows = await db
    .select({ event: topicProposalEvents, actorName: users.displayName, actorPenName: users.penName })
    .from(topicProposalEvents)
    .leftJoin(users, eq(topicProposalEvents.actorId, users.id))
    .where(inArray(topicProposalEvents.proposalId, proposalIds))
    .orderBy(asc(topicProposalEvents.createdAt));
  for (const row of rows) {
    const list = byProposal.get(row.event.proposalId) ?? [];
    list.push({ ...row.event, actorName: row.actorPenName ?? row.actorName });
    byProposal.set(row.event.proposalId, list);
  }
  return byProposal;
}

/** The writer's panel: every issue they can take part in, with their own topic and articles. */
export async function listWriterIssues(actor: Actor) {
  if (!canProposeTopics(actor)) throw forbidden();

  const [issueRows, ownProposals, ownArticles] = await Promise.all([
    db
      .select()
      .from(issues)
      .where(and(isNull(issues.deletedAt), eq(issues.adminOnly, false)))
      .orderBy(desc(issues.number)),
    db
      .select()
      .from(topicProposals)
      .where(and(eq(topicProposals.authorId, actor.id), isNull(topicProposals.deletedAt))),
    db
      .select({ id: articles.id, title: articles.title, status: articles.status, issueId: articles.issueId })
      .from(articles)
      .where(and(eq(articles.authorId, actor.id), isNull(articles.deletedAt))),
  ]);
  const events = await eventsFor(ownProposals.map((row) => row.id));

  return issueRows
    .map((issue) => {
      const proposal = ownProposals.find((row) => row.issueId === issue.id) ?? null;
      return {
        issue,
        proposal,
        events: proposal ? (events.get(proposal.id) ?? []) : [],
        articles: ownArticles.filter((row) => row.issueId === issue.id),
      };
    })
    // An issue without windows the writer has nothing in is not theirs to see
    .filter((entry) => usesIssueWindows(entry.issue) || entry.proposal || entry.articles.length > 0);
}

/** An issue's process is still running while its delivery window has not closed. */
export function isIssueInProgress(issue: Issue, now: Date): boolean {
  if (!usesIssueWindows(issue)) return false;
  const submission = periodState(submissionPeriod(issue), now);
  if (submission === "upcoming" || submission === "open") return true;
  if (submission === "closed") return false;
  const topic = periodState(topicPeriod(issue), now);
  return topic === "upcoming" || topic === "open";
}

export type ProposalFilters = { issueId?: string; status?: TopicProposalStatus };

/** The main editor's review list, with each proposal's full trail. */
export async function listTopicProposals(actor: Actor, filters: ProposalFilters = {}) {
  const assignment = await getEditorAssignment(actor.id);
  if (!canReviewTopicProposals(actor, assignment)) throw forbidden();

  const conditions = [isNull(topicProposals.deletedAt)];
  if (filters.issueId) conditions.push(eq(topicProposals.issueId, filters.issueId));
  if (filters.status) conditions.push(eq(topicProposals.status, filters.status));

  const rows = await db
    .select({
      proposal: topicProposals,
      issueNumber: issues.number,
      authorName: users.displayName,
      authorPenName: users.penName,
      authorBanned: users.isBanned,
      authorDeletedAt: users.deletedAt,
      authorWriterStatus: users.writerStatus,
    })
    .from(topicProposals)
    .innerJoin(issues, eq(topicProposals.issueId, issues.id))
    .innerJoin(users, eq(topicProposals.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(issues.number), asc(topicProposals.submittedAt));

  const events = await eventsFor(rows.map((row) => row.proposal.id));
  return rows.map((row) => ({
    ...row,
    // Shown beside the name so nobody decides for an account that can no longer write
    authorInactive:
      row.authorBanned || row.authorDeletedAt !== null || row.authorWriterStatus !== "active",
    events: events.get(row.proposal.id) ?? [],
  }));
}

/** The admin's summary of each issue whose process is running (D-261). */
export async function issueProcessSummaries(actor: Actor, now: Date = new Date()) {
  if (!canAccessAdminPanel(actor)) throw forbidden();

  const running = (
    await db
      .select()
      .from(issues)
      .where(and(isNull(issues.deletedAt), or(isNotNull(issues.topicOpensAt), isNotNull(issues.submissionOpensAt))))
      .orderBy(asc(issues.number))
  ).filter((issue) => isIssueInProgress(issue, now));
  if (running.length === 0) return [];

  // Everyone who may write their own articles today: the same test as
  // `isActiveWriter`, read from the table
  const writers = await db
    .select({ id: users.id, displayName: users.displayName, penName: users.penName })
    .from(users)
    .where(
      and(
        eq(users.writerStatus, "active"),
        ne(users.role, "user"),
        eq(users.isBanned, false),
        isNull(users.deletedAt),
        isNull(users.anonymizedAt),
        isNotNull(users.emailVerifiedAt),
      ),
    )
    .orderBy(asc(users.displayName));

  const ids = running.map((issue) => issue.id);
  const [proposals, delivered] = await Promise.all([
    db
      .select({ issueId: topicProposals.issueId, authorId: topicProposals.authorId, status: topicProposals.status })
      .from(topicProposals)
      .where(and(inArray(topicProposals.issueId, ids), isNull(topicProposals.deletedAt))),
    db
      .select({ issueId: articles.issueId, id: articles.id })
      .from(articles)
      .where(
        and(
          inArray(articles.issueId, ids),
          isNull(articles.deletedAt),
          ne(articles.status, "draft"),
          inArray(
            articles.id,
            db
              .select({ id: topicProposals.articleId })
              .from(topicProposals)
              .where(isNotNull(topicProposals.articleId)),
          ),
        ),
      ),
  ]);

  return running.map((issue) => {
    const own = proposals.filter((row) => row.issueId === issue.id);
    const count = (status: TopicProposalStatus) => own.filter((row) => row.status === status).length;
    const proposed = new Set(own.map((row) => row.authorId));
    return {
      issue,
      topicState: periodState(topicPeriod(issue), now),
      submissionState: periodState(submissionPeriod(issue), now),
      writerCount: writers.length,
      proposalCount: own.length,
      waiting: count("submitted"),
      revisionRequested: count("revision_requested"),
      accepted: count("accepted"),
      rejected: count("rejected"),
      delivered: delivered.filter((row) => row.issueId === issue.id).length,
      writersWithoutTopic: writers
        .filter((writer) => !proposed.has(writer.id))
        .map((writer) => ({ id: writer.id, name: writer.penName ?? writer.displayName })),
    };
  });
}
