import Link from "next/link";
import { notFound } from "next/navigation";
import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { templateOf } from "@/lib/issue-templates";
import { stripAnswers, parseQuestions } from "@/lib/issue-quiz";
import type { ReaderPage } from "@/lib/issue-reader";
import { readPageForEditing } from "@/services/issue-pages";
import { listQuizzes } from "@/services/issue-quizzes";
import { PageHeader } from "@/components/ui";
import { HotspotEditor, type Sibling } from "./hotspot-editor";

export const metadata = { title: "Etkileşim alanları" };

/**
 * One page, large, with its clickable areas (D-240).
 *
 * Everything about who may be here is decided in the service: the page is
 * read through `readPageForEditing`, which asks for the admin role, and the
 * picture itself comes through the page's own guarded route.
 */
export default async function HotspotPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { user } = await guardAdminWithinEditor();
  const { id, pageId } = await params;

  const found = await readPageForEditing({ ...user }, pageId).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });
  const { issue, page, siblings } = found;
  if (issue.id !== id) notFound();

  const [csrfToken, quizzes] = await Promise.all([
    readCsrfToken(),
    listQuizzes({ ...user }, issue.id),
  ]);

  const readerPage: ReaderPage = {
    id: page.id,
    position: page.position,
    template: page.template,
    templateLabel: templateOf(page.template).label,
    bleed: templateOf(page.template).bleed ?? false,
    inContents: page.inContents,
    tocTitle: page.tocTitle,
    heading: page.heading,
    standfirst: page.standfirst,
    byline: page.byline,
    // The area editor shows the picture, not the words: markdown is never
    // rendered here, so nothing unsanitised can reach the browser
    bodyHtml: null,
    caption: page.caption,
    section: page.section,
    imageUrl: page.imageUrl,
    imageAlt: page.imageAlt,
    imageWidth: page.imageWidth,
    imageHeight: page.imageHeight,
    label: page.label,
    transcript: page.transcript,
    blocks: [],
    hotspots: page.hotspots,
    article: null,
    mediaUrls: {},
    extras: null,
  };

  const list: Sibling[] = siblings.map((entry) => ({
    id: entry.id,
    position: entry.position,
    label: entry.label ?? entry.tocTitle ?? entry.heading ?? templateOf(entry.template).label,
    imageUrl: entry.imageUrl,
  }));

  return (
    <>
      <PageHeader
        title={`${page.position}. sayfa · etkileşim alanları`}
        description={
          page.imageUrl
            ? "Görselin üzerine dikdörtgen çizin ve ne yapacağını seçin."
            : "Bu sayfanın görseli yok; önce sayfa listesinden bir görsel yükleyin."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/magazine/issues/${issue.number}/oku?s=${page.id}`}
              className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Okuyucuda aç
            </Link>
            <Link
              href={`/editor/issues/${issue.id}/sayfalar`}
              className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              ← Sayfalar
            </Link>
          </div>
        }
      />

      <HotspotEditor
        issueId={issue.id}
        page={readerPage}
        siblings={list}
        // The panel's own preview plays the quiz for real, so it gets the same
        // shape a reader does — without the answer key
        quizzes={quizzes.map((quiz) =>
          stripAnswers({
            id: quiz.id,
            kind: quiz.kind,
            title: quiz.title,
            intro: quiz.intro,
            questions: parseQuestions(quiz.questions),
          }),
        )}
        csrfToken={csrfToken ?? ""}
      />
    </>
  );
}
