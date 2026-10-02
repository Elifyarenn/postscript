/**
 * Quizzes an issue carries (D-240).
 *
 * Three kinds, one shape. A knowledge quiz marks one option per question
 * right; a scored quiz gives every option a number, adds them up and names the
 * band the total falls in; a persona quiz (D-297) ties every option to a
 * result and names the result chosen most often. All are stored as one JSON
 * body per quiz.
 *
 * Grading happens on the server. The reader's copy of a quiz has the answer
 * key removed — `correct`, `points` and `outcomeId` never leave this machine — so the
 * result cannot be read out of the page before it is earned.
 */
import { z } from "zod";

export const QUIZ_KINDS = ["knowledge", "scored", "persona"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

export const QUIZ_KIND_LABELS: Record<QuizKind, string> = {
  knowledge: "Bilgi testi (doğru cevaplı)",
  scored: "Eğlence testi (puan aralıklı)",
  persona: "Kişilik testi (en çok seçilen sonuç)",
};

const shortId = z.string().trim().min(1).max(40);

export const quizOptionSchema = z.strictObject({
  id: shortId,
  text: z.string().trim().min(1).max(300),
  /** Knowledge quizzes: exactly one option per question carries this. */
  correct: z.boolean().optional(),
  /** Scored quizzes: what choosing this option is worth. */
  points: z.number().int().min(-100).max(100).optional(),
  /** Persona quizzes: the result this option counts towards. */
  outcomeId: shortId.optional(),
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
  // The band of a scored quiz; a persona result has none
  min: z.number().int().min(-1000).max(1000).default(0),
  max: z.number().int().min(-1000).max(1000).default(0),
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

/**
 * The quiz as one plain text, in reading order: what its author wrote and what
 * a licence form for it names and hashes (D-300). The answer key is not part of
 * it; a changed word changes the hash, a changed score does not.
 */
export function quizWorkText(quiz: {
  title: string;
  intro: string | null;
  questions: QuizQuestion[];
  outcomes: QuizOutcome[];
}): string {
  const parts = [quiz.title, quiz.intro ?? ""];
  for (const question of quiz.questions) {
    parts.push([question.text, ...question.options.map((option) => `- ${option.text}`)].join("\n"));
    if (question.explanation) parts.push(question.explanation);
  }
  for (const outcome of quiz.outcomes) parts.push([outcome.title, outcome.body ?? ""].join("\n\n").trim());
  return parts.filter((part) => part.trim() !== "").join("\n\n");
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
    } else if (quiz.kind === "scored") {
      if (question.options.every((option) => (option.points ?? 0) === 0)) {
        problems.push(`${at}: hiçbir seçeneğe puan verilmemiş.`);
      }
    } else {
      const known = new Set(quiz.outcomes.map((outcome) => outcome.id));
      if (question.options.some((option) => !option.outcomeId || !known.has(option.outcomeId))) {
        problems.push(`${at}: sonuca bağlanmamış seçenek var.`);
      }
    }
  }

  if (quiz.kind === "persona") {
    if (quiz.outcomes.length < 2) problems.push("En az iki sonuç tanımlanmalı.");
    const used = new Set(quiz.questions.flatMap((question) => question.options.map((option) => option.outcomeId)));
    for (const outcome of quiz.outcomes) {
      // A result nobody can get is a mistake in the key, not a rare ending
      if (!used.has(outcome.id)) problems.push(`"${outcome.title}": hiçbir seçenek bu sonuca çıkmıyor.`);
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

export type PersonaResult = {
  kind: "persona";
  total: number;
  answered: number;
  outcome: { title: string; body: string | null } | null;
};

export type QuizResult = KnowledgeResult | ScoredResult | PersonaResult;

/** What a reader sends back: one chosen option per question, at most. */
export const quizAnswerSchema = z.record(z.string().max(40), z.string().max(40));

/**
 * The result. An unanswered question is simply wrong (or worth nothing); the
 * reader is never blocked from finishing, and nothing about the attempt is
 * written down anywhere.
 *
 * A persona quiz names the result chosen most often. When two or more share
 * the lead one of them is drawn at random (D-297), so the same answers may
 * give a different result on another try; `random` is a parameter only so a
 * test can decide the draw.
 */
export function gradeQuiz(
  quiz: QuizBody,
  answers: Record<string, string>,
  random: () => number = Math.random,
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

  if (quiz.kind === "persona") {
    const counts = new Map<string, number>();
    let answered = 0;
    for (const question of quiz.questions) {
      const chosen = question.options.find((option) => option.id === answers[question.id]);
      if (!chosen) continue;
      answered += 1;
      if (chosen.outcomeId) counts.set(chosen.outcomeId, (counts.get(chosen.outcomeId) ?? 0) + 1);
    }
    const most = Math.max(0, ...counts.values());
    const leaders = quiz.outcomes.filter((outcome) => most > 0 && counts.get(outcome.id) === most);
    const outcome = leaders[Math.min(leaders.length - 1, Math.floor(random() * leaders.length))] ?? null;
    return {
      kind: "persona",
      total: quiz.questions.length,
      answered,
      outcome: outcome ? { title: outcome.title, body: outcome.body ?? null } : null,
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
