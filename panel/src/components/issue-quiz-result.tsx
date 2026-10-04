"use client";

/**
 * Sending a reader's answers and showing what came back (D-240, D-309).
 *
 * Shared by the quiz window an area opens and the quiz laid out on a page, so
 * the two never disagree on how a result reads. The marking itself happens on
 * the server; this only carries the choices there and the result back.
 */
import { Check, X } from "lucide-react";
import type { QuizResult, ReaderQuiz } from "@/lib/issue-quiz";

export async function sendQuizAnswers(quizId: string, answers: Record<string, string>): Promise<QuizResult> {
  const response = await fetch(`/api/issue-quizzes/${quizId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? ((body as { error?: { message?: string } }).error?.message ?? null)
        : null;
    throw new Error(message ?? "Sonuç alınamadı.");
  }
  return (await response.json()) as QuizResult;
}

export function QuizResultView({ quiz, result }: { quiz: ReaderQuiz; result: QuizResult }) {
  if (result.kind === "knowledge") {
    return (
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
                {!marked?.isCorrect && right && <p className="quiz-review-right">Doğrusu: {right.text}</p>}
                {marked?.explanation && <p className="quiz-review-why">{marked.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  if (result.kind === "persona") {
    return (
      <>
        <p className="quiz-score">{result.outcome?.title ?? "Hiç soru cevaplanmadı"}</p>
        {result.outcome?.body && <p className="quiz-outcome">{result.outcome.body}</p>}
        <p className="quiz-note">
          {result.answered} / {result.total} soru cevaplandı
        </p>
      </>
    );
  }

  return (
    <>
      <p className="quiz-score">
        {result.outcome?.title ?? (result.answered === 0 ? "Hiç soru cevaplanmadı" : `Puan: ${result.score}`)}
      </p>
      {result.outcome?.body && <p className="quiz-outcome">{result.outcome.body}</p>}
      <p className="quiz-note">
        {result.answered} / {result.total} soru cevaplandı · toplam {result.score} puan
      </p>
    </>
  );
}
