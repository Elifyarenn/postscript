import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { QUIZ_KIND_LABELS } from "@/lib/issue-quiz";
import { findIssue } from "@/services/issues";
import { listQuizzes } from "@/services/issue-quizzes";
import { ActionButton } from "@/components/form";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { QuizEditor, type EditableQuiz } from "./quiz-editor";
import { removeQuizAction } from "./actions";

export const metadata = { title: "Sayı testleri" };

/**
 * The quizzes an issue carries (D-236).
 *
 * A quiz lives in the issue, not on a page: the same quiz can be opened from
 * several places in the magazine without being written twice. Which page opens
 * it is decided on the page's own area editor.
 */
export default async function IssueQuizzesPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardAdminWithinEditor();
  const { id } = await params;

  const issue = await findIssue(id).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  const [quizzes, csrfToken] = await Promise.all([
    listQuizzes({ ...user }, issue.id),
    readCsrfToken(),
  ]);

  const blank: EditableQuiz = {
    id: null,
    kind: "knowledge",
    title: "",
    intro: "",
    questions: [],
    outcomes: [],
  };

  return (
    <>
      <PageHeader
        title={`Sayı ${issue.number} · testler`}
        description="Doğru cevaplı bilgi testi veya puan aralıklı eğlence testi hazırlayın; sayfalara etkileşim alanından bağlayın."
        actions={
          <Link
            href={`/editor/issues/${issue.id}/sayfalar`}
            className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
          >
            ← Sayfalar
          </Link>
        }
      />

      <div className="space-y-4">
        {quizzes.length === 0 ? (
          <EmptyState>Bu sayıda henüz test yok. Aşağıdan ilk testi oluşturun.</EmptyState>
        ) : (
          quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-lg">
                  {quiz.title}
                  <span className="ml-2 text-sm text-muted">{QUIZ_KIND_LABELS[quiz.kind]}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  {quiz.problems.length === 0 ? (
                    <span className="flex items-center gap-1.5 text-xs text-accent">
                      <Check className="size-3.5" aria-hidden /> Hazır
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-warning">
                      <AlertTriangle className="size-3.5" aria-hidden /> {quiz.problems.length} eksik
                    </span>
                  )}
                  <ActionButton
                    action={removeQuizAction}
                    csrfToken={csrfToken ?? ""}
                    label="Testi kaldır"
                    variant="danger"
                    fields={{ quizId: quiz.id, issueId: issue.id }}
                    confirmMessage={`"${quiz.title}" kaldırılsın mı? Bu teste bağlı alanların hedefi boşalır.`}
                  />
                </div>
              </div>

              <details>
                <summary className="cursor-pointer text-sm text-muted">
                  Testi düzenle ({quiz.questions.length} soru)
                </summary>
                <div className="mt-3">
                  <QuizEditor
                    issueId={issue.id}
                    csrfToken={csrfToken ?? ""}
                    quiz={{
                      id: quiz.id,
                      kind: quiz.kind,
                      title: quiz.title,
                      intro: quiz.intro ?? "",
                      questions: quiz.questions,
                      outcomes: quiz.outcomes,
                    }}
                  />
                </div>
              </details>
            </Card>
          ))
        )}

        <Card>
          <h2 className="mb-3 font-serif text-lg">Yeni test</h2>
          <QuizEditor issueId={issue.id} csrfToken={csrfToken ?? ""} quiz={blank} />
        </Card>
      </div>
    </>
  );
}
