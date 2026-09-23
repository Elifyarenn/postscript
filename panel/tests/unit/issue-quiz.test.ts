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
