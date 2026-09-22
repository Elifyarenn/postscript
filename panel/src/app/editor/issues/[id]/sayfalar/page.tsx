import Link from "next/link";
import { notFound } from "next/navigation";
import { guardAdminWithinEditor } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import { isAppError } from "@/lib/errors";
import { templateOf } from "@/lib/issue-templates";
import type { ReaderPage } from "@/lib/issue-reader";
import { findIssue } from "@/services/issues";
import { listIssuePages } from "@/services/issue-pages";
import { listArticles } from "@/services/articles";
import { listMedia } from "@/services/media";
import { listAllWriterAreasWithQuota } from "@/services/writer-areas";
import { ActionButton } from "@/components/form";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { IssuePageEditor, type EditablePage } from "./page-editor";
import {
  addIssuePageAction,
  duplicateIssuePageAction,
  moveIssuePageAction,
  removeIssuePageAction,
  updateIssuePageAction,
} from "./actions";

export const metadata = { title: "Sayı sayfaları" };

/**
 * Laying an issue out (D-234).
 *
 * Pages are added from a fixed set of layouts, ordered with plain buttons —
 * no dragging needed, so a keyboard alone is enough — and each one is edited
 * beside a live preview at desktop and phone width.
 *
 * Nothing here publishes anything: linking an article leaves its text and its
 * status untouched, and the issue's own status is changed on the issues page,
 * not this one.
 */
export default async function IssuePagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await guardAdminWithinEditor();
  const actor = { ...user };
  const { id } = await params;

  const issue = await findIssue(id).catch((error: unknown) => {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  });

  const [pages, csrfToken, media, articleList, areas] = await Promise.all([
    listIssuePages(actor, issue.id),
    readCsrfToken(),
    listMedia(actor, 200),
    listArticles(actor, { limit: 200 }),
    listAllWriterAreasWithQuota(),
  ]);

  const covers = media.map((item) => ({
    id: item.id,
    label: item.altText?.trim() || item.storageKey.split("/").pop() || item.id.slice(0, 8),
  }));
  const articles = articleList.map((article) => ({
    id: article.id,
    label: `${article.title} · ${article.status}`,
  }));
  const sections = areas.map((area) => area.name);

  /** The reader's shape of a page, for the live preview in the form. */
  const asReaderPage = (page: (typeof pages)[number] | null, position: number): ReaderPage => ({
    id: page?.id ?? "new",
    position,
    template: page?.template ?? "article_opening",
    templateLabel: templateOf(page?.template ?? "article_opening").label,
    bleed: templateOf(page?.template ?? "article_opening").bleed ?? false,
    inContents: page?.inContents ?? true,
    tocTitle: page?.tocTitle ?? null,
    heading: page?.heading ?? null,
    standfirst: page?.standfirst ?? null,
    byline: page?.byline ?? null,
    bodyHtml: null,
    caption: page?.caption ?? null,
    section: page?.section ?? null,
    imageUrl: page?.imageUrl ?? null,
    imageAlt: page?.imageAlt ?? null,
    blocks: page?.blocks ?? [],
    article: null,
    mediaUrls: {},
    extras: null,
  });

  const blank: EditablePage = {
    id: null,
    position: pages.length + 1,
    template: "article_opening",
    tocTitle: "",
    inContents: true,
    heading: "",
    standfirst: "",
    byline: "",
    body: "",
    caption: "",
    section: "",
    imageMediaId: "",
    articleId: "",
    blocks: [],
  };

  return (
    <>
      <PageHeader
        title={`Sayı ${issue.number} · sayfalar`}
        description="Boş şablonlardan sayının akışını kurun; içerik sonradan doldurulabilir."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/magazine/issues/${issue.number}/oku`}
              className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Okuyucuda önizle
            </Link>
            <Link
              href="/editor/issues"
              className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              ← Sayılar
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusBadge status={issue.status} />
        <span>
          {issue.title}
          {issue.theme ? ` · ${issue.theme}` : ""}
        </span>
        <span>{pages.length} sayfa</span>
      </div>

      <div className="space-y-4">
        {pages.length === 0 ? (
          <EmptyState>
            Bu sayıya henüz sayfa eklenmedi. Aşağıdan bir şablon seçip ilk sayfayı ekleyin.
          </EmptyState>
        ) : (
          pages.map((page, index) => (
            <Card key={page.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-lg">
                  {page.position}. {templateOf(page.template).label}
                  {page.tocTitle || page.heading ? (
                    <span className="ml-2 text-sm text-muted">{page.tocTitle ?? page.heading}</span>
                  ) : null}
                </h2>

                <div className="flex flex-wrap gap-2">
                  {/* Plain buttons rather than dragging, so a keyboard is enough */}
                  <ActionButton
                    action={moveIssuePageAction}
                    csrfToken={csrfToken ?? ""}
                    label="Yukarı taşı"
                    variant="ghost"
                    display="↑"
                    fields={{ pageId: page.id, issueId: issue.id, direction: "up" }}
                  />
                  <ActionButton
                    action={moveIssuePageAction}
                    csrfToken={csrfToken ?? ""}
                    label="Aşağı taşı"
                    variant="ghost"
                    display="↓"
                    fields={{ pageId: page.id, issueId: issue.id, direction: "down" }}
                  />
                  <ActionButton
                    action={duplicateIssuePageAction}
                    csrfToken={csrfToken ?? ""}
                    label="Çoğalt"
                    fields={{ pageId: page.id, issueId: issue.id }}
                  />
                  <ActionButton
                    action={removeIssuePageAction}
                    csrfToken={csrfToken ?? ""}
                    label="Kaldır"
                    variant="danger"
                    fields={{ pageId: page.id, issueId: issue.id }}
                    confirmMessage={`${page.position}. sayfa kaldırılsın mı?`}
                  />
                </div>
              </div>

              <details open={index === 0}>
                <summary className="cursor-pointer text-sm text-muted">Sayfayı düzenle</summary>
                <div className="mt-3">
                  <IssuePageEditor
                    issueId={issue.id}
                    csrfToken={csrfToken ?? ""}
                    action={updateIssuePageAction}
                    submitLabel="Kaydet"
                    covers={covers}
                    articles={articles}
                    sections={sections}
                    preview={asReaderPage(page, page.position)}
                    page={{
                      id: page.id,
                      position: page.position,
                      template: page.template,
                      tocTitle: page.tocTitle ?? "",
                      inContents: page.inContents,
                      heading: page.heading ?? "",
                      standfirst: page.standfirst ?? "",
                      byline: page.byline ?? "",
                      body: page.body ?? "",
                      caption: page.caption ?? "",
                      section: page.section ?? "",
                      imageMediaId: "",
                      articleId: page.article?.id ?? "",
                      blocks: page.blocks,
                    }}
                  />
                </div>
              </details>
            </Card>
          ))
        )}

        <Card>
          <h2 className="mb-3 font-serif text-lg">Sayfa ekle</h2>
          <IssuePageEditor
            issueId={issue.id}
            csrfToken={csrfToken ?? ""}
            action={addIssuePageAction}
            submitLabel="Sayfayı ekle"
            covers={covers}
            articles={articles}
            sections={sections}
            preview={asReaderPage(null, pages.length + 1)}
            page={blank}
          />
        </Card>
      </div>
    </>
  );
}
