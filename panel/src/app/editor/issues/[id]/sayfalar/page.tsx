import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
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
import { Alert, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { IssuePageEditor, type EditablePage } from "./page-editor";
import { IssuePageList, type ListedPage } from "./page-list";
import { PageUploader } from "./page-uploader";
import { PreviewBuilder } from "./preview-builder";
import { addIssuePageAction, updateIssuePageAction } from "./actions";

export const metadata = { title: "Sayı sayfaları" };

// Drawing the seven preview pages takes a few seconds each on the server (D-247)
export const maxDuration = 120;

/**
 * Preparing an issue (D-234, reshaped by D-240).
 *
 * Pages are the designs as delivered: upload them, put them in order, say what
 * each one is, and then draw the clickable areas on them. The template layouts
 * from D-234 are still here, at the bottom, for anything already typed and for
 * a page that has no artwork.
 *
 * Nothing here publishes anything: the issue's status is changed on the issues
 * page, not this one, and linking an article leaves its text untouched.
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

  const listed: ListedPage[] = pages.map((page) => ({
    id: page.id,
    position: page.position,
    template: page.template,
    label: page.label,
    tocTitle: page.tocTitle,
    inContents: page.inContents,
    imageUrl: page.imageUrl,
    imageAlt: page.imageAlt,
    imageWidth: page.imageWidth,
    imageHeight: page.imageHeight,
    transcript: page.transcript,
    hotspotCount: page.hotspots.length,
    unfinishedCount: page.hotspots.filter((area) => !area.ready).length,
  }));

  const covers = media.map((item) => ({
    id: item.id,
    label: item.altText?.trim() || item.storageKey.split("/").pop() || item.id.slice(0, 8),
  }));
  const articles = articleList.map((article) => ({
    id: article.id,
    label: `${article.title} · ${article.status}`,
  }));
  const sections = areas.map((area) => area.name);

  /** Pages with no artwork: still laid out from a template, still editable. */
  const templatePages = pages.filter((page) => page.imageUrl === null);

  /** The reader's shape of a page, for the live preview inside the form. */
  const asReaderPage = (page: (typeof pages)[number] | null): ReaderPage => {
    const template = templateOf(page?.template ?? "article_opening");
    return {
      id: page?.id ?? "new",
      position: page?.position ?? pages.length + 1,
      template: page?.template ?? "article_opening",
      templateLabel: template.label,
      bleed: template.bleed ?? false,
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
      imageWidth: page?.imageWidth ?? null,
      imageHeight: page?.imageHeight ?? null,
      label: page?.label ?? null,
      transcript: page?.transcript ?? null,
      blocks: page?.blocks ?? [],
      hotspots: [],
      article: null,
      mediaUrls: {},
      extras: null,
    };
  };

  const blankPreview = asReaderPage(null);

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
        description="Tasarlanmış sayfa görsellerini yükleyin, sıralayın ve üzerlerine etkileşim alanları koyun."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/magazine/issues/${issue.number}/oku`}
              className="rounded-md border border-accent bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Okuyucuda önizle
            </Link>
            <Link
              href={`/editor/issues/${issue.id}/testler`}
              className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-paper"
            >
              Testler
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

      {issue.adminOnly && (
        <Alert tone="warning" title="Yalnızca iki admin — örnek sayı">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            Bu sayı geliştirme/örnek sayıdır. Okuyucusu, sayfaları, görselleri ve testleri
            yalnızca yönetici hesaplarına açıktır; editörler, yazarlar ve üyeler göremez.
          </span>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusBadge status={issue.status} />
        <span>
          {issue.title}
          {issue.theme ? ` · ${issue.theme}` : ""}
        </span>
        <span>{pages.length} sayfa</span>
      </div>

      {issue.adminOnly && (
        <Card className="mb-4">
          <h2 className="mb-3 font-serif text-lg">Geçici önizleme</h2>
          <PreviewBuilder issueId={issue.id} csrfToken={csrfToken ?? ""} />
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 font-serif text-lg">Sayfa görseli yükle</h2>
        <PageUploader issueId={issue.id} csrfToken={csrfToken ?? ""} />
      </Card>

      {pages.length === 0 ? (
        <EmptyState>
          Bu sayıda henüz sayfa yok. Yukarıdan tasarlanmış sayfa görsellerini yükleyin.
        </EmptyState>
      ) : (
        <IssuePageList issueId={issue.id} csrfToken={csrfToken ?? ""} pages={listed} />
      )}

      {/* Kept from D-234: pages laid out from a template, for anything that
          has no artwork. Nothing already typed was removed or migrated, and
          those pages are still edited the way they always were. */}
      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-muted">
          Şablon sayfaları (görselsiz yerleşim) — {templatePages.length} sayfa
        </summary>

        <div className="mt-3 space-y-4">
          {templatePages.map((page) => (
            <Card key={page.id}>
              <h3 className="mb-3 font-serif text-base">
                {page.position}. {templateOf(page.template).label}
                {page.tocTitle || page.heading ? (
                  <span className="ml-2 text-sm text-muted">{page.tocTitle ?? page.heading}</span>
                ) : null}
              </h3>
              <IssuePageEditor
                issueId={issue.id}
                csrfToken={csrfToken ?? ""}
                action={updateIssuePageAction}
                submitLabel="Kaydet"
                covers={covers}
                articles={articles}
                sections={sections}
                preview={asReaderPage(page)}
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
            </Card>
          ))}

          <Card>
            <h3 className="mb-3 font-serif text-base">Şablondan sayfa ekle</h3>
            <IssuePageEditor
              issueId={issue.id}
              csrfToken={csrfToken ?? ""}
              action={addIssuePageAction}
              submitLabel="Sayfayı ekle"
              covers={covers}
              articles={articles}
              sections={sections}
              preview={blankPreview}
              page={blank}
            />
          </Card>
        </div>
      </details>
    </>
  );
}
