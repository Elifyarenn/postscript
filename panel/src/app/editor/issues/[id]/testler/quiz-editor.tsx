"use client";

/**
 * Writing a quiz in the panel (D-236).
 *
 * Both kinds are the same form with a different middle: a knowledge quiz
 * marks one option right per question, a scored quiz gives every option a
 * number and names a result for each band of totals.
 *
 * The whole quiz travels as one JSON field, so it is saved in one write and
 * can never end up half written. What is wrong with it is listed as it is
 * typed, with the same function the reader's door uses — so "hazır" in the
 * panel and "playable" in the magazine can never disagree.
 */
import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitRow } from "@/components/form";
import type { ActionState } from "@/lib/action";
import {
  QUIZ_KINDS,
  QUIZ_KIND_LABELS,
  quizProblems,
  scoreRange,
  type QuizKind,
  type QuizOutcome,
  type QuizQuestion,
} from "@/lib/issue-quiz";
import { createQuizAction, updateQuizAction } from "./actions";

let counter = 0;
const newId = () => `q${Date.now().toString(36)}${(counter += 1).toString(36)}`;

export type EditableQuiz = {
  id: string | null;
  kind: QuizKind;
  title: string;
  intro: string;
  questions: QuizQuestion[];
  outcomes: QuizOutcome[];
};

export function QuizEditor({
  issueId,
  csrfToken,
  quiz,
}: {
  issueId: string;
  csrfToken: string;
  quiz: EditableQuiz;
}) {
  const [kind, setKind] = useState<QuizKind>(quiz.kind);
  const [title, setTitle] = useState(quiz.title);
  const [intro, setIntro] = useState(quiz.intro);
  const [questions, setQuestions] = useState<QuizQuestion[]>(quiz.questions);
  const [outcomes, setOutcomes] = useState<QuizOutcome[]>(quiz.outcomes);
  const [state, formAction] = useActionState<ActionState, FormData>(
    quiz.id ? updateQuizAction : createQuizAction,
    null,
  );

  const problems = useMemo(
    () => quizProblems({ kind, questions, outcomes }),
    [kind, outcomes, questions],
  );
  const range = useMemo(() => scoreRange(questions), [questions]);

  const patchQuestion = (id: string, change: Partial<QuizQuestion>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...change } : question)),
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [
      ...current,
      {
        id: newId(),
        text: "",
        explanation: "",
        options: [
          { id: newId(), text: "", ...(kind === "knowledge" ? { correct: true } : { points: 0 }) },
          { id: newId(), text: "", ...(kind === "knowledge" ? { correct: false } : { points: 0 }) },
        ],
      },
    ]);
  };

  const move = (index: number, by: number) => {
    setQuestions((current) => {
      const next = [...current];
      const to = index + by;
      if (to < 0 || to >= next.length) return current;
      next.splice(to, 0, ...next.splice(index, 1));
      return next;
    });
  };

  const payload = {
    kind,
    title,
    intro: intro.trim() === "" ? null : intro,
    // Empty rows are the residue of typing, not part of the quiz
    questions: questions
      .filter((question) => question.text.trim() !== "")
      .map((question) => ({
        ...question,
        explanation: question.explanation?.trim() ? question.explanation : null,
        options: question.options.filter((option) => option.text.trim() !== ""),
      })),
    outcomes: kind === "scored" ? outcomes.filter((outcome) => outcome.title.trim() !== "") : [],
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="issueId" value={issueId} />
      {quiz.id && <input type="hidden" name="quizId" value={quiz.id} />}
      <input type="hidden" name="quiz" value={JSON.stringify(payload)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Test türü">
          <Select value={kind} onChange={(event) => setKind(event.target.value as QuizKind)}>
            {QUIZ_KINDS.map((option) => (
              <option key={option} value={option}>
                {QUIZ_KIND_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Test başlığı">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} />
        </Field>
      </div>

      <Field label="Kısa açıklama" hint="Testin ilk ekranında görünür.">
        <Textarea rows={2} value={intro} onChange={(event) => setIntro(event.target.value)} maxLength={1000} />
      </Field>

      {problems.length > 0 ? (
        <Alert tone="warning" title="Test henüz okura gösterilmez">
          <ul className="mt-1 list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-accent">
          <Check className="size-4" aria-hidden /> Test hazır.
        </p>
      )}

      {/* ------------------------------------------------------------ */}
      {/* Questions                                                     */}
      {/* ------------------------------------------------------------ */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-md border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{index + 1}. soru</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => move(index, -1)}
                  aria-label="Yukarı taşı"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => move(index, 1)}
                  aria-label="Aşağı taşı"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    setQuestions((current) => current.filter((entry) => entry.id !== question.id))
                  }
                  aria-label="Soruyu sil"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>

            <Field label="Soru">
              <Textarea
                rows={2}
                value={question.text}
                onChange={(event) => patchQuestion(question.id, { text: event.target.value })}
                maxLength={600}
              />
            </Field>

            <ul className="mt-2 space-y-2">
              {question.options.map((option) => (
                <li key={option.id} className="flex flex-wrap items-center gap-2">
                  {kind === "knowledge" ? (
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={option.correct === true}
                        onChange={() =>
                          patchQuestion(question.id, {
                            // Exactly one right answer: choosing one unchooses
                            // the rest, so the quiz cannot be saved ambiguous
                            options: question.options.map((entry) => ({
                              ...entry,
                              correct: entry.id === option.id,
                            })),
                          })
                        }
                      />
                      Doğru
                    </label>
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs">
                      Puan
                      <Input
                        type="number"
                        className="w-20"
                        value={option.points ?? 0}
                        onChange={(event) =>
                          patchQuestion(question.id, {
                            options: question.options.map((entry) =>
                              entry.id === option.id
                                ? { ...entry, points: Number(event.target.value) || 0 }
                                : entry,
                            ),
                          })
                        }
                      />
                    </label>
                  )}

                  <Input
                    className="min-w-0 flex-1"
                    value={option.text}
                    placeholder="Seçenek"
                    maxLength={300}
                    onChange={(event) =>
                      patchQuestion(question.id, {
                        options: question.options.map((entry) =>
                          entry.id === option.id ? { ...entry, text: event.target.value } : entry,
                        ),
                      })
                    }
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() =>
                      patchQuestion(question.id, {
                        options: question.options.filter((entry) => entry.id !== option.id),
                      })
                    }
                    aria-label="Seçeneği sil"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-2.5 py-1 text-xs"
                onClick={() =>
                  patchQuestion(question.id, {
                    options: [
                      ...question.options,
                      {
                        id: newId(),
                        text: "",
                        ...(kind === "knowledge" ? { correct: false } : { points: 0 }),
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-1 inline size-3.5" aria-hidden /> Seçenek
              </Button>
            </div>

            {kind === "knowledge" && (
              <Field label="Cevap açıklaması (isteğe bağlı)">
                <Textarea
                  rows={2}
                  value={question.explanation ?? ""}
                  onChange={(event) => patchQuestion(question.id, { explanation: event.target.value })}
                  maxLength={1000}
                />
              </Field>
            )}
          </div>
        ))}

        <Button type="button" variant="secondary" className="px-3 py-1.5 text-sm" onClick={addQuestion}>
          <Plus className="mr-1 inline size-4" aria-hidden /> Soru ekle
        </Button>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Outcome bands                                                 */}
      {/* ------------------------------------------------------------ */}
      {kind === "scored" && (
        <div className="space-y-3 rounded-md border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Sonuç aralıkları</h3>
            <span className="text-xs text-muted">
              Ulaşılabilir puan: {range.min} – {range.max}
            </span>
          </div>

          {outcomes.map((outcome) => (
            <div key={outcome.id} className="space-y-2 rounded border border-line p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="min-w-0 flex-1"
                  value={outcome.title}
                  placeholder="Sonuç başlığı"
                  maxLength={200}
                  onChange={(event) =>
                    setOutcomes((current) =>
                      current.map((entry) =>
                        entry.id === outcome.id ? { ...entry, title: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <label className="flex items-center gap-1 text-xs">
                  En az
                  <Input
                    type="number"
                    className="w-20"
                    value={outcome.min}
                    onChange={(event) =>
                      setOutcomes((current) =>
                        current.map((entry) =>
                          entry.id === outcome.id
                            ? { ...entry, min: Number(event.target.value) || 0 }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-1 text-xs">
                  En çok
                  <Input
                    type="number"
                    className="w-20"
                    value={outcome.max}
                    onChange={(event) =>
                      setOutcomes((current) =>
                        current.map((entry) =>
                          entry.id === outcome.id
                            ? { ...entry, max: Number(event.target.value) || 0 }
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setOutcomes((current) => current.filter((entry) => entry.id !== outcome.id))}
                  aria-label="Aralığı sil"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Sonuç açıklaması"
                value={outcome.body ?? ""}
                maxLength={1500}
                onChange={(event) =>
                  setOutcomes((current) =>
                    current.map((entry) =>
                      entry.id === outcome.id ? { ...entry, body: event.target.value } : entry,
                    ),
                  )
                }
              />
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            className="px-2.5 py-1 text-xs"
            onClick={() =>
              setOutcomes((current) => [
                ...current,
                {
                  id: newId(),
                  title: "",
                  body: "",
                  min: current.length === 0 ? range.min : (current[current.length - 1]!.max ?? 0) + 1,
                  max: range.max,
                },
              ])
            }
          >
            <Plus className="mr-1 inline size-3.5" aria-hidden /> Aralık ekle
          </Button>
        </div>
      )}

      {problems.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <AlertTriangle className="size-3.5 text-warning" aria-hidden />
          Eksik bir test kaydedilebilir, ama okura açılmaz.
        </p>
      )}

      <SubmitRow state={state} label={quiz.id ? "Testi kaydet" : "Testi oluştur"} />
    </form>
  );
}
