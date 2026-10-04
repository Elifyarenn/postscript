"use client";

/**
 * A quiz laid out as a page of the magazine (D-309).
 *
 * Every question and every option is on the page from the start, as it would
 * be in print; the reader marks their choices on the page and the result opens
 * under the questions, on the same page. No window, no hidden area to find.
 *
 * The options are native radio buttons: one choice per question, the keyboard
 * moves inside a question without turning the page (the reader ignores keys
 * pressed in an input), and a screen reader announces each group by its
 * question. Marking happens on the server, as in the window (D-240); nothing
 * about the attempt is stored.
 */
import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { QuizResult, ReaderQuiz } from "@/lib/issue-quiz";
import { QuizResultView, sendQuizAnswers } from "./issue-quiz-result";

export function IssueQuizPage({ quiz, section }: { quiz: ReaderQuiz; section: string | null }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLHeadingElement>(null);

  const total = quiz.questions.length;
  const answered = quiz.questions.filter((question) => answers[question.id]).length;
  // A result from half the questions would describe someone else
  const complete = total > 0 && answered === total;

  // The result opens below the questions, out of sight on a phone: bring it
  // into view and give it the focus, so it is read out as well as seen
  useEffect(() => {
    if (!result) return;
    const box = resultRef.current;
    if (!box) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    box.focus({ preventScroll: true });
  }, [result]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete || sending) return;
    setSending(true);
    setError(null);
    try {
      setResult(await sendQuizAnswers(quiz.id, answers));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sonuç alınamadı.");
    } finally {
      setSending(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  return (
    <form className="quiz-page" onSubmit={submit} aria-label={quiz.title}>
      {section && <p className="page-section-name">{section}</p>}
      <h1 className="page-heading quiz-page-title" ref={topRef}>
        {quiz.title}
      </h1>
      {quiz.intro && <p className="quiz-intro">{quiz.intro}</p>}

      <ol className="quiz-page-questions">
        {quiz.questions.map((question, number) => (
          <li key={question.id}>
            <fieldset disabled={result !== null || sending}>
              <legend className="quiz-question">
                <span className="quiz-page-number" aria-hidden>
                  {String(number + 1).padStart(2, "0")}
                </span>
                {question.text}
              </legend>
              <div className="quiz-page-options">
                {question.options.map((option) => (
                  <label key={option.id} data-chosen={answers[question.id] === option.id ? "" : undefined}>
                    <input
                      type="radio"
                      // Unique per quiz, so two quizzes in one spread never share a group
                      name={`${quiz.id}:${question.id}`}
                      value={option.id}
                      checked={answers[question.id] === option.id}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {result === null ? (
        <div className="quiz-page-submit">
          <button type="submit" disabled={!complete || sending}>
            {sending ? "Sonuç hesaplanıyor…" : "Sonucumu göster"}
          </button>
          <p className="quiz-note" aria-live="polite">
            {complete ? "Bütün sorular cevaplandı." : `${answered} / ${total} soru cevaplandı`}
          </p>
          {error && <p className="quiz-error">{error}</p>}
        </div>
      ) : (
        <div className="quiz-page-result" ref={resultRef} tabIndex={-1} aria-live="polite">
          <p className="quiz-page-result-label">Sonucun</p>
          <QuizResultView quiz={quiz} result={result} />
          <div className="quiz-foot">
            <button type="button" onClick={restart}>
              <RotateCcw aria-hidden /> Yeniden çöz
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
