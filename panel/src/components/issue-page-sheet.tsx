"use client";

/**
 * One magazine page, drawn from its layout (D-234).
 *
 * Every layout is ordinary markup in the magazine's own colours and type, so
 * the words stay selectable and a screen reader meets headings, paragraphs and
 * figures rather than a picture of a page.
 *
 * Where content has not been typed yet the page shows a marked, quiet gap —
 * "[Başlık]", "[Metin alanı]" — so the design can be judged before the issue
 * is written. These gaps are never invented text and never a flickering
 * skeleton; in the published view an empty optional block is simply left out.
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Play, ZoomIn } from "lucide-react";
import { blockIsReady, type PageBlock } from "@/lib/issue-blocks";
import { FIELD_PLACEHOLDERS, templateAsks, templateOf, type PageField } from "@/lib/issue-templates";
import type { ReaderPage } from "@/lib/issue-reader";

/** A gap the editor still has to fill; shown only while laying the issue out. */
function Gap({ field }: { field: PageField }) {
  return <span className="page-gap">{FIELD_PLACEHOLDERS[field]}</span>;
}

function Line({
  value,
  field,
  preview,
  className,
  as: Tag = "p",
}: {
  value: string | null;
  field: PageField;
  preview: boolean;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  if (!value && !preview) return null;
  return <Tag className={className}>{value ?? <Gap field={field} />}</Tag>;
}

function Body({ html, preview }: { html: string | null; preview: boolean }) {
  if (html) return <div className="page-body" dangerouslySetInnerHTML={{ __html: html }} />;
  if (!preview) return null;
  return (
    <div className="page-body">
      <Gap field="body" />
    </div>
  );
}

function Picture({
  page,
  preview,
  className,
}: {
  page: ReaderPage;
  preview: boolean;
  className?: string;
}) {
  if (!page.imageUrl) {
    // An empty frame rather than a broken-image icon, and nothing at all once
    // the issue is out
    return preview ? (
      <div className={`page-frame page-frame-empty ${className ?? ""}`}>
        <Gap field="image" />
      </div>
    ) : null;
  }
  return (
    <figure className={`page-frame ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the media route streams the stored file */}
      <img src={page.imageUrl} alt={page.imageAlt ?? ""} loading="lazy" decoding="async" />
      {(page.caption || preview) && (
        <figcaption>{page.caption ?? <Gap field="caption" />}</figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Interaction blocks                                                  */
/* ------------------------------------------------------------------ */

function ZoomBlock({ url, caption }: { url: string | null; caption: string }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <figure className="page-block page-zoom">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {/* eslint-disable-next-line @next/next/no-img-element -- stored media */}
        <img src={url} alt={caption} loading="lazy" decoding="async" data-open={open ? "" : undefined} />
        <span className="page-zoom-hint">
          <ZoomIn aria-hidden /> {open ? "Küçült" : "Büyüt"}
        </span>
      </button>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function GalleryBlock({ urls, caption }: { urls: string[]; caption: string }) {
  const [at, setAt] = useState(0);
  if (urls.length === 0) return null;
  return (
    <figure className="page-block page-gallery">
      {/* eslint-disable-next-line @next/next/no-img-element -- stored media */}
      <img src={urls[Math.min(at, urls.length - 1)]} alt={caption} loading="lazy" decoding="async" />
      <div className="page-gallery-dots">
        {urls.map((url, position) => (
          <button
            key={url}
            type="button"
            aria-label={`Görsel ${position + 1}`}
            aria-current={position === at ? "true" : undefined}
            onClick={() => setAt(position)}
          />
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function AsideBlock({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="page-block page-aside">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {title || "Kenar notu"}
        <ChevronDown aria-hidden data-open={open ? "" : undefined} />
      </button>
      {open && <p>{body}</p>}
    </div>
  );
}

function MediaBlock({ url, media, title }: { url: string; media: "audio" | "video"; title: string }) {
  const [started, setStarted] = useState(false);
  // Nothing loads, and nothing sounds, until the reader asks for it
  if (!started) {
    return (
      <div className="page-block page-media">
        <button type="button" onClick={() => setStarted(true)}>
          <Play aria-hidden fill="currentColor" /> {title || (media === "audio" ? "Sesi aç" : "Videoyu aç")}
        </button>
      </div>
    );
  }
  return (
    <div className="page-block page-media">
      {media === "audio" ? (
        <audio src={url} controls autoPlay aria-label={title || "Ses"} />
      ) : (
        <video src={url} controls autoPlay playsInline aria-label={title || "Video"} />
      )}
    </div>
  );
}

function QuizBlock({
  question,
  options,
  answer,
  explanation,
}: {
  question: string;
  options: string[];
  answer: number | null;
  explanation: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="page-block page-quiz">
      <p className="page-quiz-question">{question}</p>
      <ul>
        {options.map((option, position) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => setPicked(position)}
              aria-pressed={picked === position}
              data-state={
                picked === null ? undefined : position === answer ? "right" : picked === position ? "wrong" : undefined
              }
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
      {picked !== null && explanation && <p className="page-quiz-note">{explanation}</p>}
    </div>
  );
}

function Blocks({
  blocks,
  page,
  preview,
}: {
  blocks: PageBlock[];
  page: ReaderPage;
  preview: boolean;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className="page-blocks">
      {blocks.map((block, position) => {
        const ready = blockIsReady(block);
        if (!ready) {
          // Half-filled blocks are the editor's business; a reader never meets
          // a control that would do nothing
          return preview ? (
            <p key={position} className="page-block page-block-empty">
              [{blockKindLabel(block.kind)} — içerik girilmedi]
            </p>
          ) : null;
        }

        switch (block.kind) {
          case "zoom":
            return (
              <ZoomBlock
                key={position}
                url={block.mediaId ? (page.mediaUrls[block.mediaId] ?? null) : null}
                caption={block.caption}
              />
            );
          case "gallery":
            return (
              <GalleryBlock
                key={position}
                urls={block.mediaIds.map((id) => page.mediaUrls[id]).filter((url): url is string => Boolean(url))}
                caption={block.caption}
              />
            );
          case "aside":
            return <AsideBlock key={position} title={block.title} body={block.body} />;
          case "quote":
            return (
              <blockquote key={position} className="page-block page-quote">
                <p>{block.text}</p>
                {block.source && <cite>{block.source}</cite>}
              </blockquote>
            );
          case "related":
            return <RelatedBlock key={position} page={page} />;
          case "media":
            return <MediaBlock key={position} url={block.url} media={block.media} title={block.title} />;
          case "playlist":
            return <PlaylistBlock key={position} page={page} preview={preview} />;
          case "quiz":
            return (
              <QuizBlock
                key={position}
                question={block.question}
                options={block.options}
                answer={block.answer}
                explanation={block.explanation}
              />
            );
        }
      })}
    </div>
  );
}

function blockKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    zoom: "Büyüyen görsel",
    gallery: "Galeri",
    aside: "Kenar notu",
    quote: "Alıntı",
    related: "İlgili yazı",
    media: "Ses / video",
    playlist: "Çalma listesi",
    quiz: "Soru",
  };
  return labels[kind] ?? kind;
}

function RelatedBlock({ page }: { page: ReaderPage }) {
  const article = page.article;
  if (!article?.slug) return null;
  return (
    <p className="page-block page-related">
      <Link href={`/magazine/articles/${article.slug}`}>İlgili yazı: {article.title}</Link>
    </p>
  );
}

function PlaylistBlock({ page, preview }: { page: ReaderPage; preview: boolean }) {
  const playlist = page.extras?.playlist;
  if (!playlist || playlist.tracks.length === 0) {
    return preview ? <p className="page-block page-block-empty">[Çalma listesi tanımlı değil]</p> : null;
  }
  return (
    <div className="page-block page-playlist">
      {playlist.name && <p className="page-playlist-name">{playlist.name}</p>}
      <ol>
        {playlist.tracks.map((track, position) => (
          <li key={`${track.title}-${track.artist}`}>
            <span aria-hidden>{String(position + 1).padStart(2, "0")}</span>
            <span>
              {track.title}
              <small>{track.artist}</small>
            </span>
            <span>{track.duration}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The page itself                                                     */
/* ------------------------------------------------------------------ */

export function IssuePageSheet({ page, preview }: { page: ReaderPage; preview: boolean }) {
  const template = templateOf(page.template);
  const asks = (field: PageField) => templateAsks(page.template, field);
  // A linked article lends the page its words when the page has none of its own
  const bodyHtml = page.bodyHtml ?? page.article?.bodyHtml ?? null;

  const heading = (
    <Line
      as="h1"
      className="page-heading"
      value={page.heading ?? page.article?.title ?? null}
      field="heading"
      preview={preview}
    />
  );
  const standfirst = asks("standfirst") ? (
    <Line className="page-standfirst" value={page.standfirst} field="standfirst" preview={preview} />
  ) : null;
  const byline = asks("byline") ? (
    <Line
      className="page-byline"
      value={page.byline ?? page.article?.authorName ?? null}
      field="byline"
      preview={preview}
    />
  ) : null;

  const inner = () => {
    switch (page.template) {
      case "cover":
        return (
          <div className="page-cover">
            {page.imageUrl && <Picture page={page} preview={preview} className="page-cover-art" />}
            <div className="page-cover-words">
              <p className="page-cover-mark">postscript</p>
              {heading}
              {standfirst}
            </div>
          </div>
        );

      case "back_cover":
        return (
          <div className="page-cover page-back">
            {page.imageUrl && <Picture page={page} preview={preview} className="page-cover-art" />}
            <div className="page-cover-words">
              {heading}
              {standfirst}
              <p className="page-cover-mark">postscript</p>
            </div>
          </div>
        );

      case "theme_opening":
        return (
          <div className="page-theme">
            {heading}
            {standfirst}
            <Picture page={page} preview={preview} />
          </div>
        );

      case "section_opening":
        return (
          <div className="page-section">
            {asks("section") && (
              <Line className="page-section-name" value={page.section} field="section" preview={preview} />
            )}
            {heading}
            {standfirst}
            <Picture page={page} preview={preview} />
          </div>
        );

      case "full_bleed":
        return (
          <div className="page-bleed">
            <Picture page={page} preview={preview} className="page-bleed-art" />
            {(page.heading || preview) && (
              <Line className="page-bleed-words" value={page.heading} field="heading" preview={preview} />
            )}
          </div>
        );

      case "visual_article":
        return (
          <div className="page-visual">
            <Picture page={page} preview={preview} className="page-visual-art" />
            <div className="page-visual-words">
              {page.section && <p className="page-section-name">{page.section}</p>}
              {heading}
              {standfirst}
              {byline}
              <Body html={bodyHtml} preview={preview} />
              <Blocks blocks={page.blocks} page={page} preview={preview} />
            </div>
          </div>
        );

      case "collage_opening":
        return (
          <div className="page-collage">
            <span className="page-collage-star" aria-hidden />
            <span className="page-collage-rule" aria-hidden />
            <div className="page-collage-art">
              <Picture page={page} preview={preview} />
            </div>
            <div className="page-collage-words">
              {page.section && <p className="page-section-name">{page.section}</p>}
              {heading}
              {standfirst}
              {byline}
              <Body html={bodyHtml} preview={preview} />
              <Blocks blocks={page.blocks} page={page} preview={preview} />
            </div>
          </div>
        );

      case "article_continued":
        return (
          <div className="page-column">
            {page.heading && <p className="page-running-head">{page.heading}</p>}
            <Body html={bodyHtml} preview={preview} />
            <Picture page={page} preview={preview} />
            <Blocks blocks={page.blocks} page={page} preview={preview} />
          </div>
        );

      case "contents":
        return (
          <div className="page-contents">
            {heading}
            {standfirst}
            <p className="page-contents-note">
              Bu sayfa sayının içindekilerini gösterir; okuyucudaki içindekiler listesiyle aynı
              kaynaktan gelir.
            </p>
          </div>
        );

      case "picks":
        return (
          <div className="page-picks">
            {heading}
            {standfirst}
            {page.extras && page.extras.picks.length > 0 ? (
              <ul>
                {page.extras.picks.map((pick) => (
                  <li key={`${pick.kind}-${pick.title}`}>
                    <p className="page-picks-kind">{pick.kind}</p>
                    <p className="page-picks-title">
                      {pick.title} ({pick.year}) — {pick.credit}
                    </p>
                    <p className="page-picks-text">{pick.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              preview && <p className="page-block-empty">[Sayının seçkisi tanımlı değil]</p>
            )}
          </div>
        );

      case "playlist":
        return (
          <div className="page-column">
            {heading}
            {standfirst}
            <PlaylistBlock page={page} preview={preview} />
          </div>
        );

      case "masthead":
        return (
          <div className="page-masthead">
            {heading}
            <Body html={bodyHtml} preview={preview} />
          </div>
        );

      default:
        // editorial, article_opening, interactive, ps_closing: one column
        return (
          <div className="page-column">
            {page.section && <p className="page-section-name">{page.section}</p>}
            {heading}
            {standfirst}
            {byline}
            {asks("image") && <Picture page={page} preview={preview} />}
            <Body html={bodyHtml} preview={preview} />
            <Blocks blocks={page.blocks} page={page} preview={preview} />
          </div>
        );
    }
  };

  return (
    <article
      className="page-sheet"
      data-template={page.template}
      data-bleed={template.bleed ? "" : undefined}
      aria-label={`Sayfa ${page.position}`}
    >
      {inner()}
      <p className="page-folio" aria-hidden>
        {page.position}
      </p>
    </article>
  );
}
