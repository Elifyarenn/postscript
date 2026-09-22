"use client";

/**
 * Taking a quiz inside the magazine (D-236).
 *
 * One question at a time, with the progress shown, and a result at the end.
 * The marking happens on the server: the browser never receives the answer
 * key, so the result cannot be read out of the page before it is earned.
 *
 * Nothing is stored. Closing the quiz puts the reader back on the page they
 * were on, at the place they were at, and trying again costs nothing.
 */
import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { ReaderQuiz } from "@/lib/issue-quiz";

type Result =
  | {
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
    }
  | {
      kind: "scored";
      score: number;
      total: number;
      answered: number;
      outcome: { title: string; body: string | null } | null;
    };

export function IssueQuizPlayer({ quiz, onClose }: { quiz: ReaderQuiz; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = quiz.questions.length;
  const question = quiz.questions[at];
  const chosen = question ? answers[question.id] : undefined;

  const restart = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    setAt(0);
  };

  const send = async (finalAnswers: Record<string, string>) => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/issue-quizzes/${quiz.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && "error" in body
            ? ((body as { error?: { message?: string } }).error?.message ?? null)
            : null;
        throw new Error(message ?? "Sonuç alınamadı.");
      }
      setResult((await response.json()) as Result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sonuç alınamadı.");
    } finally {
      setSending(false);
    }
  };

  const choose = (optionId: string) => {
    if (!question) return;
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    // The last answer finishes the quiz; anything before it moves on
    if (at + 1 < total) setAt(at + 1);
    else void send(next);
  };

  return (
    <div className="reader-overlay" role="dialog" aria-modal="true" aria-label={quiz.title}>
      <div className="reader-panel reader-panel-quiz">
        <header className="reader-panel-head">
          <h2>{quiz.title}</h2>
          <button type="button" className="reader-icon" onClick={onClose} aria-label="Testi kapat">
            <X aria-hidden />
          </button>
        </header>

        {result === null ? (
          <div className="quiz-body">
            {at === 0 && quiz.intro && <p className="quiz-intro">{quiz.intro}</p>}

            <p className="quiz-progress" aria-live="polite">
              {Math.min(at + 1, total)} / {total}
              <span className="quiz-bar" aria-hidden>
                <span style={{ width: `${total ? ((at + 1) / total) * 100 : 0}%` }} />
              </span>
            </p>

            {question ? (
              <>
                <p className="quiz-question">{question.text}</p>
                <ul className="quiz-options">
                  {question.options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => choose(option.id)}
                        disabled={sending}
                        aria-pressed={chosen === option.id}
                      >
                        {option.text}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="quiz-foot">
                  <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0}>
                    Geri
                  </button>
                  {sending && <span className="quiz-sending">Sonuç hesaplanıyor…</span>}
                </div>
              </>
            ) : (
              <p>Bu testte soru yok.</p>
            )}

            {error && <p className="quiz-error">{error}</p>}
          </div>
        ) : (
          <div className="quiz-body">
            {result.kind === "knowledge" ? (
              <>
                <p className="quiz-score">
                  {result.correctCount} / {result.total} doğru
                </p>
                <ol className="quiz-review">
                  {quiz.questions.map((entry) => {
                    const marked = result.answers.find((answer) => answer.questionId === entry.id);
                    const right = entry.options.find((option) => option.id === marked?.correctId);
                    const mine = entry.options.find((option) => option.id === marked?.chosenId);
                    return (
                      <li key={entry.id} data-correct={marked?.isCorrect ? "" : undefined}>
                        <p className="quiz-review-q">{entry.text}</p>
                        <p className="quiz-review-a">
                          {marked?.isCorrect ? <Check aria-hidden /> : <X aria-hidden />}
                          {mine ? mine.text : "Cevaplanmadı"}
                        </p>
                        {!marked?.isCorrect && right && (
                          <p className="quiz-review-right">Doğrusu: {right.text}</p>
                        )}
                        {marked?.explanation && <p className="quiz-review-why">{marked.explanation}</p>}
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <>
                <p className="quiz-score">
                  {result.outcome?.title ??
                    (result.answered === 0 ? "Hiç soru cevaplanmadı" : `Puan: ${result.score}`)}
                </p>
                {result.outcome?.body && <p className="quiz-outcome">{result.outcome.body}</p>}
                <p className="quiz-note">
                  {result.answered} / {result.total} soru cevaplandı · toplam {result.score} puan
                </p>
              </>
            )}

            <div className="quiz-foot">
              <button type="button" onClick={restart}>
                <RotateCcw aria-hidden /> Yeniden çöz
              </button>
              <button type="button" onClick={onClose}>
                Dergiye dön
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
