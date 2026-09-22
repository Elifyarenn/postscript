import "server-only";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { issueQuizzes, issues, type Issue } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { canAccessAdminPanel, type Actor } from "@/lib/auth/rbac";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import {
  gradeQuiz,
  parseOutcomes,
  parseQuestions,
  quizInputSchema,
  quizProblems,
  type QuizKind,
  type QuizOutcome,
  type QuizQuestion,
  type QuizResult,
} from "@/lib/issue-quiz";
import { mayReadIssue } from "./issue-pages";
import type { RequestMeta } from "./auth";

/**
 * The quizzes an issue carries (D-236).
 *
 * Writing one is the admin's, exactly like laying the issue out. Answering one
 * goes through `answerQuiz`, which asks the same door the reader went through
 * to open the issue — so a quiz belonging to a closed issue cannot be played
 * by guessing its id, and the answer key is never sent anywhere.
 */

export type QuizSummary = {
  id: string;
  kind: QuizKind;
  title: string;
  intro: string | null;
  questions: QuizQuestion[];
  outcomes: QuizOutcome[];
  /** Empty when a reader may be shown it; otherwise what is missing. */
  problems: string[];
};

function toSummary(row: typeof issueQuizzes.$inferSelect): QuizSummary {
  const questions = parseQuestions(row.questions);
  const outcomes = parseOutcomes(row.outcomes);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    intro: row.intro,
    questions,
    outcomes,
    problems: quizProblems({ kind: row.kind, questions, outcomes }),
  };
}

function assertQuizRight(actor: Actor): void {
  if (!canAccessAdminPanel(actor)) throw forbidden("Test hazırlama yalnızca yöneticinindir.");
}

async function issueById(issueId: string): Promise<Issue> {
  const [row] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!row || row.deletedAt) throw notFound("Sayı bulunamadı.");
  return row;
}

/** Every quiz of an issue, with its answer key: the panel's view. */
export async function listQuizzes(actor: Actor, issueId: string): Promise<QuizSummary[]> {
  assertQuizRight(actor);
  const rows = await db
    .select()
    .from(issueQuizzes)
    .where(eq(issueQuizzes.issueId, issueId))
    .orderBy(asc(issueQuizzes.createdAt));
  return rows.map(toSummary);
}

export async function createQuiz(
  actor: Actor,
  issueId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<string> {
  assertQuizRight(actor);
  await issueById(issueId);

  const parsed = quizInputSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Test bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);

  const [row] = await db
    .insert(issueQuizzes)
    .values({
      issueId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      intro: parsed.data.intro ?? null,
      questions: parsed.data.questions,
      // A knowledge quiz has no bands; keeping them would only confuse a later read
      outcomes: parsed.data.kind === "scored" ? parsed.data.outcomes : [],
    })
    .returning({ id: issueQuizzes.id });

  await writeAudit({
    actorId: actor.id,
    action: "issue_quiz.created",
    entityType: "issue_quizzes",
    entityId: row!.id,
    after: { issueId, kind: parsed.data.kind },
    ip: meta.ip,
  });
  return row!.id;
}

export async function updateQuiz(
  actor: Actor,
  quizId: string,
  rawInput: unknown,
  meta: RequestMeta,
): Promise<void> {
  assertQuizRight(actor);
  const parsed = quizInputSchema.safeParse(rawInput);
  if (!parsed.success) throw badRequest("Test bilgileri geçersiz.", z.flattenError(parsed.error).fieldErrors);

  const updated = await db
    .update(issueQuizzes)
    .set({
      kind: parsed.data.kind,
      title: parsed.data.title,
      intro: parsed.data.intro ?? null,
      questions: parsed.data.questions,
      outcomes: parsed.data.kind === "scored" ? parsed.data.outcomes : [],
      updatedAt: new Date(),
    })
    .where(eq(issueQuizzes.id, quizId))
    .returning({ id: issueQuizzes.id });
  if (!updated[0]) throw notFound("Test bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "issue_quiz.updated",
    entityType: "issue_quizzes",
    entityId: quizId,
    after: { kind: parsed.data.kind, questions: parsed.data.questions.length },
    ip: meta.ip,
  });
}

/**
 * Removes a quiz. The areas that pointed at it keep their rectangle and lose
 * their target, which the panel then shows as unfinished — better than a
 * silent hole a reader would find first.
 */
export async function removeQuiz(actor: Actor, quizId: string, meta: RequestMeta): Promise<void> {
  assertQuizRight(actor);
  const removed = await db
    .delete(issueQuizzes)
    .where(eq(issueQuizzes.id, quizId))
    .returning({ id: issueQuizzes.id });
  if (!removed[0]) throw notFound("Test bulunamadı.");

  await writeAudit({
    actorId: actor.id,
    action: "issue_quiz.removed",
    entityType: "issue_quizzes",
    entityId: quizId,
    ip: meta.ip,
  });
}

/**
 * Marks a reader's answers.
 *
 * The door is asked again here, from the issue the quiz belongs to: opening a
 * quiz is opening the issue. Nothing about the attempt is written down — no
 * archive, no leaderboard, no counter — so the only thing that leaves is the
 * result the reader just earned.
 */
export async function answerQuiz(
  actor: Actor | null,
  quizId: string,
  answers: Record<string, string>,
): Promise<QuizResult> {
  const rows = await db
    .select({ quiz: issueQuizzes, issue: issues })
    .from(issueQuizzes)
    .innerJoin(issues, eq(issueQuizzes.issueId, issues.id))
    .where(eq(issueQuizzes.id, quizId))
    .limit(1);
  const found = rows[0];
  if (!found || found.issue.deletedAt) throw notFound("Test bulunamadı.");
  if (!mayReadIssue(actor, found.issue)) throw notFound("Test bulunamadı.");

  const body = {
    kind: found.quiz.kind,
    questions: parseQuestions(found.quiz.questions),
    outcomes: parseOutcomes(found.quiz.outcomes),
  };
  // An unfinished quiz cannot produce an honest result, so it produces none
  if (quizProblems(body).length > 0) throw badRequest("Bu test henüz tamamlanmadı.");

  return gradeQuiz(body, answers);
}
