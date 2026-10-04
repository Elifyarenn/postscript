"use client";

/**
 * Taking a quiz inside the magazine, in a window an area opens (D-240).
 *
 * One question at a time, with the progress shown, and a result at the end.
 * The marking happens on the server: the browser never receives the answer
 * key, so the result cannot be read out of the page before it is earned.
 *
 * Nothing is stored. Closing the quiz puts the reader back on the page they
 * were on, at the place they were at, and trying again costs nothing. A quiz
 * that has a page of its own is answered there instead (D-309).
 */
import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { QuizResult, ReaderQuiz } from "@/lib/issue-quiz";
import { QuizResultView, sendQuizAnswers } from "./issue-quiz-result";

export function IssueQuizPlayer({ quiz, onClose }: { quiz: ReaderQuiz; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
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
      setResult(await sendQuizAnswers(quiz.id, finalAnswers));
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
            <QuizResultView quiz={quiz} result={result} />
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
