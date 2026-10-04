/**
 * Marking a quiz, and knowing when one is not ready to be marked (D-240).
 */
import { describe, expect, it } from "vitest";
import {
  gradeQuiz,
  outcomeProblems,
  parseQuestions,
  quizProblems,
  scoreRange,
  stripAnswers,
  type QuizOutcome,
  type QuizQuestion,
} from "@/lib/issue-quiz";
import { OBSESSION_QUIZ } from "@/lib/issue-design/issue-01-quizzes";

const knowledge: QuizQuestion[] = [
  {
    id: "q1",
    text: "Sayının teması nedir?",
    explanation: "Kapakta yazıyor.",
    options: [
      { id: "a", text: "Obsession", correct: true },
      { id: "b", text: "Başka bir şey", correct: false },
    ],
  },
  {
    id: "q2",
    text: "Kaç sayfa?",
    options: [
      { id: "c", text: "On", correct: false },
      { id: "d", text: "On altı", correct: true },
    ],
  },
];

const scored: QuizQuestion[] = [
  {
    id: "s1",
    text: "Sabah mı akşam mı?",
    options: [
      { id: "a", text: "Sabah", points: 0 },
      { id: "b", text: "Akşam", points: 3 },
    ],
  },
  {
    id: "s2",
    text: "Kalabalık mı sessizlik mi?",
    options: [
      { id: "c", text: "Kalabalık", points: 1 },
      { id: "d", text: "Sessizlik", points: 2 },
    ],
  },
];

const bands: QuizOutcome[] = [
  { id: "low", title: "Sakin", body: null, min: 1, max: 3 },
  { id: "high", title: "Tutkulu", body: "Bırakamıyorsun.", min: 4, max: 5 },
];

describe("a knowledge quiz", () => {
  it("counts the right answers and explains each one", () => {
    const result = gradeQuiz(
      { kind: "knowledge", questions: knowledge, outcomes: [] },
      { q1: "a", q2: "c" },
    );
    if (result.kind !== "knowledge") throw new Error("wrong kind");

    expect(result.correctCount).toBe(1);
    expect(result.total).toBe(2);
    expect(result.answers[0]).toMatchObject({ isCorrect: true, explanation: "Kapakta yazıyor." });
    expect(result.answers[1]).toMatchObject({ isCorrect: false, correctId: "d" });
  });

  it("treats an unanswered question as wrong rather than refusing to finish", () => {
    const result = gradeQuiz({ kind: "knowledge", questions: knowledge, outcomes: [] }, {});
    if (result.kind !== "knowledge") throw new Error("wrong kind");
    expect(result.correctCount).toBe(0);
    expect(result.answers.every((answer) => answer.chosenId === null)).toBe(true);
  });

  it("refuses to be called ready without exactly one right answer", () => {
    const none = knowledge.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option, correct: false })),
    }));
    expect(quizProblems({ kind: "knowledge", questions: none, outcomes: [] })).toEqual([
      "1. soru: doğru cevap işaretlenmemiş.",
      "2. soru: doğru cevap işaretlenmemiş.",
    ]);

    const two = [
      { ...knowledge[0]!, options: knowledge[0]!.options.map((o) => ({ ...o, correct: true })) },
    ];
    expect(quizProblems({ kind: "knowledge", questions: two, outcomes: [] })).toEqual([
      "1. soru: birden fazla doğru cevap işaretli.",
    ]);
  });
});

describe("a scored quiz", () => {
  it("adds the points up and names the band they land in", () => {
    const result = gradeQuiz({ kind: "scored", questions: scored, outcomes: bands }, { s1: "b", s2: "d" });
    if (result.kind !== "scored") throw new Error("wrong kind");

    expect(result.score).toBe(5);
    expect(result.answered).toBe(2);
    expect(result.outcome).toEqual({ title: "Tutkulu", body: "Bırakamıyorsun." });
  });

  it("scores what was answered and ignores what was not", () => {
    const result = gradeQuiz({ kind: "scored", questions: scored, outcomes: bands }, { s2: "c" });
    if (result.kind !== "scored") throw new Error("wrong kind");
    expect(result.score).toBe(1);
    expect(result.answered).toBe(1);
    expect(result.outcome?.title).toBe("Sakin");
  });

  it("knows the totals it can produce", () => {
    expect(scoreRange(scored)).toEqual({ min: 1, max: 5 });
  });

  it("catches bands that cross, that gap, and that leave a total homeless", () => {
    const range = { min: 1, max: 5 };
    expect(outcomeProblems(bands, range)).toEqual([]);

    const crossing: QuizOutcome[] = [
      { id: "a", title: "A", body: null, min: 1, max: 4 },
      { id: "b", title: "B", body: null, min: 3, max: 5 },
    ];
    expect(outcomeProblems(crossing, range)[0]).toMatch(/çakışıyor/);

    const gapped: QuizOutcome[] = [
      { id: "a", title: "A", body: null, min: 1, max: 2 },
      { id: "b", title: "B", body: null, min: 4, max: 5 },
    ];
    expect(outcomeProblems(gapped, range)[0]).toMatch(/boşluk/);

    const short: QuizOutcome[] = [{ id: "a", title: "A", body: null, min: 1, max: 3 }];
    expect(outcomeProblems(short, range)[0]).toMatch(/En yüksek puan/);
  });

  it("is not ready while a question is worth nothing whatever you pick", () => {
    const flat = [{ ...scored[0]!, options: scored[0]!.options.map((o) => ({ ...o, points: 0 })) }];
    expect(quizProblems({ kind: "scored", questions: flat, outcomes: bands })).toContain(
      "1. soru: hiçbir seçeneğe puan verilmemiş.",
    );
  });
});

describe("what the reader is handed", () => {
  it("keeps the answer key on the server", () => {
    const reader = stripAnswers({
      id: "quiz-1",
      kind: "knowledge",
      title: "Sayı testi",
      intro: null,
      questions: knowledge,
    });

    const flat = JSON.stringify(reader);
    expect(flat).not.toContain("correct");
    expect(flat).not.toContain("points");
    expect(flat).not.toContain("Kapakta yazıyor");
    expect(reader.questions[0]!.options).toEqual([
      { id: "a", text: "Obsession" },
      { id: "b", text: "Başka bir şey" },
    ]);
  });

  it("drops a question it can no longer read rather than losing the quiz", () => {
    const parsed = parseQuestions([knowledge[0], { id: "broken" }, "nonsense"]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.id).toBe("q1");
  });
});

describe("a persona quiz (D-297)", () => {
  const body = { kind: OBSESSION_QUIZ.kind, questions: OBSESSION_QUIZ.questions, outcomes: OBSESSION_QUIZ.outcomes };
  const pick = (...personas: string[]) =>
    // Options are a, b, c, d in the order Monica, Joe, Nina, Beth
    Object.fromEntries(
      personas.map((persona, index) => [`s${index + 1}`, `s${index + 1}-${"abcd"[["monica", "joe", "nina", "beth"].indexOf(persona)]}`]),
    );

  it("ships finished: five questions, four options each, four results", () => {
    expect(quizProblems(body)).toEqual([]);
    expect(body.questions.map((question) => question.options.length)).toEqual([4, 4, 4, 4, 4]);
    expect(body.outcomes.map((outcome) => outcome.id)).toEqual(["monica", "joe", "nina", "beth"]);
  });

  it("names the result chosen most often", () => {
    const result = gradeQuiz(body, pick("beth", "nina", "beth", "joe", "beth"));
    if (result.kind !== "persona") throw new Error("wrong kind");
    expect(result.outcome?.title).toBe("Beth’in hiper-odağı");
    expect(result.answered).toBe(5);
  });

  it("draws one of the leaders when they are level, and never anyone else", () => {
    const tied = pick("monica", "joe", "monica", "joe", "nina");
    const first = gradeQuiz(body, tied, () => 0);
    const last = gradeQuiz(body, tied, () => 0.999);
    if (first.kind !== "persona" || last.kind !== "persona") throw new Error("wrong kind");
    expect(first.outcome?.title).toContain("Monica");
    expect(last.outcome?.title).toContain("Joe");

    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const result = gradeQuiz(body, tied);
      if (result.kind === "persona" && result.outcome) seen.add(result.outcome.title.slice(0, 3));
    }
    expect([...seen].every((name) => name === "Mon" || name === "Joe")).toBe(true);
  });

  it("gives no result when nothing was answered", () => {
    const result = gradeQuiz(body, {});
    if (result.kind !== "persona") throw new Error("wrong kind");
    expect(result.outcome).toBeNull();
    expect(result.answered).toBe(0);
  });

  it("keeps who each option belongs to away from the reader", () => {
    const flat = JSON.stringify(stripAnswers({ id: "x", ...OBSESSION_QUIZ, intro: null }));
    expect(flat).not.toContain("outcomeId");
    expect(flat).not.toMatch(/Monica|Joe|Nina|Beth/);
  });

  it("is not ready with an unbound option, an unreachable result or a single result", () => {
    const loose = body.questions.map((question, index) =>
      index === 0
        ? { ...question, options: question.options.map((option) => ({ id: option.id, text: option.text })) }
        : question,
    );
    expect(quizProblems({ ...body, questions: loose })).toContain("1. soru: sonuca bağlanmamış seçenek var.");

    const extra = [...body.outcomes, { id: "kimse", title: "Kimse", body: null, min: 0, max: 0 }];
    expect(quizProblems({ ...body, outcomes: extra })).toContain('"Kimse": hiçbir seçenek bu sonuca çıkmıyor.');

    expect(quizProblems({ ...body, outcomes: body.outcomes.slice(0, 1) })).toContain("En az iki sonuç tanımlanmalı.");
  });
});
