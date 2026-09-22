/**
 * Quizzes an issue carries (D-236).
 *
 * Two kinds, one shape. A knowledge quiz marks one option per question right;
 * a scored quiz gives every option a number, adds them up and names the band
 * the total falls in. Both are stored as one JSON body per quiz.
 *
 * Grading happens on the server. The reader's copy of a quiz has the answer
 * key removed — `correct` and `points` never leave this machine — so the
 * result cannot be read out of the page before it is earned.
 */
import { z } from "zod";

export const QUIZ_KINDS = ["knowledge", "scored"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

export const QUIZ_KIND_LABELS: Record<QuizKind, string> = {
  knowledge: "Bilgi testi (doğru cevaplı)",
  scored: "Eğlence testi (puan aralıklı)",
};

const shortId = z.string().trim().min(1).max(40);

export const quizOptionSchema = z.strictObject({
  id: shortId,
  text: z.string().trim().min(1).max(300),
  /** Knowledge quizzes: exactly one option per question carries this. */
  correct: z.boolean().optional(),
  /** Scored quizzes: what choosing this option is worth. */
  points: z.number().int().min(-100).max(100).optional(),
});

export const quizQuestionSchema = z.strictObject({
  id: shortId,
  text: z.string().trim().min(1).max(600),
  /** Shown after answering, in a knowledge quiz. */
  explanation: z.string().trim().max(1000).optional().nullable(),
  options: z.array(quizOptionSchema).min(2).max(8),
});

export const quizOutcomeSchema = z.strictObject({
  id: shortId,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(1500).optional().nullable(),
  min: z.number().int().min(-1000).max(1000),
  max: z.number().int().min(-1000).max(1000),
});

export type QuizOption = z.infer<typeof quizOptionSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizOutcome = z.infer<typeof quizOutcomeSchema>;

export const quizInputSchema = z.strictObject({
  kind: z.enum(QUIZ_KINDS),
  title: z.string().trim().min(2).max(200),
  intro: z.string().trim().max(1000).optional().nullable(),
  questions: z.array(quizQuestionSchema).max(40),
  outcomes: z.array(quizOutcomeSchema).max(12),
});

export type QuizInput = z.infer<typeof quizInputSchema>;

/**
 * Reads a stored body back, dropping whatever no longer parses instead of
 * throwing: a quiz written by an older shape must not take a page down with
 * it. The same forgiving read as `parseBlocks` (D-234).
 */
export function parseQuestions(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = quizQuestionSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseOutcomes(raw: unknown): QuizOutcome[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = quizOutcomeSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/* ------------------------------------------------------------------ */
/* Is it finished?                                                     */
/* ------------------------------------------------------------------ */

export type QuizBody = { kind: QuizKind; questions: QuizQuestion[]; outcomes: QuizOutcome[] };

/** The lowest and highest total a scored quiz can produce. */
export function scoreRange(questions: QuizQuestion[]): { min: number; max: number } {
  return questions.reduce(
    (total, question) => {
      const points = question.options.map((option) => option.points ?? 0);
      return {
        min: total.min + Math.min(...points),
        max: total.max + Math.max(...points),
      };
    },
    { min: 0, max: 0 },
  );
}

/**
 * Everything wrong with a quiz, in the words the panel prints. An empty list
 * means a reader can be shown it; anything else and it stays closed, because a
 * quiz that cannot produce a result is worse than a missing one.
 */
export function quizProblems(quiz: QuizBody): string[] {
  const problems: string[] = [];
  if (quiz.questions.length === 0) problems.push("Testte hiç soru yok.");

  for (const [index, question] of quiz.questions.entries()) {
    const at = `${index + 1}. soru`;
    if (quiz.kind === "knowledge") {
      const right = question.options.filter((option) => option.correct === true).length;
      if (right === 0) problems.push(`${at}: doğru cevap işaretlenmemiş.`);
      if (right > 1) problems.push(`${at}: birden fazla doğru cevap işaretli.`);
    } else if (question.options.every((option) => (option.points ?? 0) === 0)) {
      problems.push(`${at}: hiçbir seçeneğe puan verilmemiş.`);
    }
  }

  if (quiz.kind === "scored") {
    if (quiz.outcomes.length === 0) {
      problems.push("Sonuç aralığı tanımlanmamış.");
    } else {
      problems.push(...outcomeProblems(quiz.outcomes, scoreRange(quiz.questions)));
    }
  }
  return problems;
}

/** Bands that cross each other, run backwards, or leave a total unanswered. */
export function outcomeProblems(
  outcomes: QuizOutcome[],
  range: { min: number; max: number },
): string[] {
  const problems: string[] = [];
  const sorted = [...outcomes].sort((a, b) => a.min - b.min);

  for (const outcome of sorted) {
    if (outcome.max < outcome.min) problems.push(`"${outcome.title}": üst sınır alt sınırdan küçük.`);
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const before = sorted[i - 1]!;
    const here = sorted[i]!;
    if (here.min <= before.max) {
      problems.push(`"${before.title}" ile "${here.title}" aralıkları çakışıyor.`);
    } else if (here.min > before.max + 1) {
      problems.push(`"${before.title}" ile "${here.title}" arasında boşluk var.`);
    }
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  // Every reachable total must land somewhere, or someone finishes the quiz
  // and is told nothing
  if (first && first.min > range.min) problems.push(`En düşük puan (${range.min}) hiçbir aralığa girmiyor.`);
  if (last && last.max < range.max) problems.push(`En yüksek puan (${range.max}) hiçbir aralığa girmiyor.`);

  return problems;
}

export function quizIsReady(quiz: QuizBody): boolean {
  return quizProblems(quiz).length === 0;
}

/* ------------------------------------------------------------------ */
/* What the reader gets, and what grading gives back                   */
/* ------------------------------------------------------------------ */

export type ReaderQuiz = {
  id: string;
  kind: QuizKind;
  title: string;
  intro: string | null;
  questions: { id: string; text: string; options: { id: string; text: string }[] }[];
};

/** The quiz without its answer key: what is safe to send to a browser. */
export function stripAnswers(quiz: {
  id: string;
  kind: QuizKind;
  title: string;
  intro: string | null;
  questions: QuizQuestion[];
}): ReaderQuiz {
  return {
    id: quiz.id,
    kind: quiz.kind,
    title: quiz.title,
    intro: quiz.intro,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      text: question.text,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
    })),
  };
}

export type KnowledgeResult = {
  kind: "knowledge";
  correctCount: number;
  total: number;
  answers: {
    questionId: string;
    chosenId: string | null;
    correctId: string | null;
    isCorrect: boolean;
    explanation: string | null;
  }[];
};

export type ScoredResult = {
  kind: "scored";
  score: number;
  total: number;
  answered: number;
  outcome: { title: string; body: string | null } | null;
};

export type QuizResult = KnowledgeResult | ScoredResult;

/** What a reader sends back: one chosen option per question, at most. */
export const quizAnswerSchema = z.record(z.string().max(40), z.string().max(40));

/**
 * The result. An unanswered question is simply wrong (or worth nothing); the
 * reader is never blocked from finishing, and nothing about the attempt is
 * written down anywhere.
 */
export function gradeQuiz(
  quiz: QuizBody,
  answers: Record<string, string>,
): QuizResult {
  if (quiz.kind === "knowledge") {
    const marked = quiz.questions.map((question) => {
      const correct = question.options.find((option) => option.correct === true) ?? null;
      const chosen = answers[question.id] ?? null;
      return {
        questionId: question.id,
        chosenId: chosen,
        correctId: correct?.id ?? null,
        isCorrect: correct !== null && chosen === correct.id,
        explanation: question.explanation ?? null,
      };
    });
    return {
      kind: "knowledge",
      correctCount: marked.filter((entry) => entry.isCorrect).length,
      total: quiz.questions.length,
      answers: marked,
    };
  }

  let score = 0;
  let answered = 0;
  for (const question of quiz.questions) {
    const chosen = question.options.find((option) => option.id === answers[question.id]);
    if (!chosen) continue;
    answered += 1;
    score += chosen.points ?? 0;
  }

  const outcome =
    quiz.outcomes.find((band) => score >= band.min && score <= band.max) ?? null;

  return {
    kind: "scored",
    score,
    total: quiz.questions.length,
    answered,
    outcome: outcome ? { title: outcome.title, body: outcome.body ?? null } : null,
  };
}
