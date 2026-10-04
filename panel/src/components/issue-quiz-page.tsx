"use client";

/**
 * A quiz laid out as a page of the magazine (D-309, one question at a time
 * since D-311).
 *
 * The page shows one question with its options and how far along the reader
 * is. Choosing an option moves straight on to the next question; the previous
 * one is a button away and keeps its choice. The fifth answer brings the
 * result onto the same page, in place of the questions. No window opens and
 * nothing is scrolled:
 *
 *  - a question is fitted to the page by shrinking its type a little, never
 *    below a readable size (`useFitToBox`);
 *  - a result is longer than any phone page at a readable size, so it is set
 *    in page-wide columns, as a magazine continues an article, and the reader
 *    turns through them with "Devamı" (`useColumnParts`).
 *
 * Marking happens on the server, as in the window (D-240); nothing about the
 * attempt is stored.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { QuizResult, ReaderQuiz } from "@/lib/issue-quiz";
import { QuizResultView, sendQuizAnswers } from "./issue-quiz-result";

/**
 * The least a question's type may shrink to. The options are set at 15px, so
 * this keeps them at 14px or more: smaller is no longer comfortable on a phone.
 */
const MIN_FIT = 0.93;

/** The space between two parts of a result; only seen while measuring. */
const PART_GAP = 32;

/**
 * Shrinks the box's type, in small steps, until its content fits its height.
 * The step is written straight to the element rather than kept in state, so
 * fitting never costs a render. It runs again whenever the content (`key`) or
 * the page's size changes: turning the phone, zooming the reader.
 */
function useFitToBox(key: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      let scale = 1;
      box.style.setProperty("--fit", "1");
      while (box.scrollHeight > box.clientHeight + 1 && scale > MIN_FIT) {
        scale = Math.max(MIN_FIT, Math.round((scale - 0.01) * 100) / 100);
        box.style.setProperty("--fit", String(scale));
      }
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    return () => watch.disconnect();
  }, [key]);

  return ref;
}

/**
 * Lays the content out in columns exactly as wide as the box, so each column
 * is one part the size of the page, and counts them. The count is read again
 * whenever the page's size changes.
 */
function useColumnParts(active: boolean) {
  const boxRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const flow = flowRef.current;
    if (!active || !box || !flow) return;
    const watch = new ResizeObserver(() => {
      const width = box.clientWidth;
      flow.style.setProperty("--part-width", `${width}px`);
      flow.style.setProperty("--part-gap", `${PART_GAP}px`);
      setParts(Math.max(1, Math.round((flow.scrollWidth + PART_GAP) / (width + PART_GAP))));
    });
    watch.observe(box);
    return () => watch.disconnect();
  }, [active]);

  return { boxRef, flowRef, parts };
}

export function IssueQuizPage({ quiz, section }: { quiz: ReaderQuiz; section: string | null }) {
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [part, setPart] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Focus follows the reader only after they have done something, never on arrival
  const [touched, setTouched] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);

  const total = quiz.questions.length;
  const question = result === null ? quiz.questions[at] : undefined;
  // "Yeniden çöz" mounts a new box, so the result is part of the key
  const fitRef = useFitToBox(`${result ? "result" : at}:${sending}:${error ?? ""}`);
  const { boxRef, flowRef, parts } = useColumnParts(result !== null);
  // A turned phone can leave fewer parts than the one being read
  const shownPart = Math.min(part, parts - 1);

  // A new question or the result is announced by moving the focus to it
  useEffect(() => {
    if (touched) focusRef.current?.focus({ preventScroll: true });
  }, [at, result, touched]);

  const send = async (finalAnswers: Record<string, string>) => {
    setSending(true);
    setError(null);
    try {
      setResult(await sendQuizAnswers(quiz.id, finalAnswers));
      setPart(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sonuç alınamadı.");
    } finally {
      setSending(false);
    }
  };

  const choose = (optionId: string) => {
    if (!question || sending) return;
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    setTouched(true);
    // The last answer brings the result; any other moves on
    if (at + 1 < total) setAt(at + 1);
    else void send(next);
  };

  const back = () => {
    setTouched(true);
    setError(null);
    setAt(Math.max(0, at - 1));
  };

  const restart = () => {
    setAnswers({});
    setResult(null);
    setPart(0);
    setError(null);
    setTouched(true);
    setAt(0);
  };

  // The bar is full once the result is in, and counts answered questions before
  const done = result ? total : Object.keys(answers).length;
  const shown = Math.min(at + 1, total);

  return (
    <section className="quiz-page" aria-label={quiz.title}>
      <header className="quiz-page-head">
        {section && <p className="page-section-name">{section}</p>}
        <h1 className="page-heading quiz-page-title">{quiz.title}</h1>
        <p className="quiz-progress">
          <span aria-live="polite">{result ? "Sonuç" : `Soru ${shown} / ${total}`}</span>
          <span
            className="quiz-bar"
            role="progressbar"
            aria-label="İlerleme"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </span>
        </p>
      </header>

      {result ? (
        <div className="quiz-page-stage" ref={boxRef}>
          <div
            className="quiz-page-parts"
            ref={flowRef}
            style={{ "--part": shownPart } as React.CSSProperties}
          >
            <div className="quiz-page-result" ref={focusRef} tabIndex={-1}>
              <QuizResultView quiz={quiz} result={result} />
            </div>
          </div>
        </div>
      ) : (
        <div className="quiz-page-stage" ref={fitRef}>
          <div className="quiz-page-fit" ref={focusRef} tabIndex={-1}>
            {question ? (
              <>
                {at === 0 && quiz.intro && <p className="quiz-intro">{quiz.intro}</p>}
                <p className="quiz-question" id={`${quiz.id}-q`}>
                  <span className="quiz-page-number" aria-hidden>
                    {String(at + 1).padStart(2, "0")}
                  </span>
                  {question.text}
                </p>
                <ul className="quiz-options" aria-labelledby={`${quiz.id}-q`}>
                  {question.options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => choose(option.id)}
                        disabled={sending}
                        aria-pressed={answers[question.id] === option.id}
                      >
                        {option.text}
                      </button>
                    </li>
                  ))}
                </ul>
                {sending && <p className="quiz-sending">Sonuç hesaplanıyor…</p>}
                {error && <p className="quiz-error">{error}</p>}
              </>
            ) : (
              <p>Bu testte soru yok.</p>
            )}
          </div>
        </div>
      )}

      <div className="quiz-foot">
        {result ? (
          <>
            {parts > 1 && (
              <>
                <button type="button" onClick={() => setPart(shownPart - 1)} disabled={shownPart === 0}>
                  <ChevronLeft aria-hidden /> Geri
                </button>
                <span className="quiz-note" aria-live="polite">
                  {shownPart + 1} / {parts}
                </span>
                <button type="button" onClick={() => setPart(shownPart + 1)} disabled={shownPart >= parts - 1}>
                  Devamı <ChevronRight aria-hidden />
                </button>
              </>
            )}
            <button type="button" className="quiz-page-restart" onClick={restart}>
              <RotateCcw aria-hidden /> Yeniden çöz
            </button>
          </>
        ) : (
          <button type="button" onClick={back} disabled={at === 0 || sending}>
            <ChevronLeft aria-hidden /> Önceki soru
          </button>
        )}
      </div>
    </section>
  );
}
