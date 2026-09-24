/**
 * The temporary page designs of the preview issue (D-247).
 *
 * Each function returns what `next/og` draws — one A4 page at 150 dpi — and
 * the rectangles on it that should become clickable areas, in the page's own
 * pixels. Both come from the same constants, so an area always sits on the
 * thing it opens.
 *
 * These are stand-ins, not a new way of making pages: they come out as
 * ordinary page pictures and the designers' PNG/WebP files replace them from
 * the panel like any other picture. Every one of them says, in the picture
 * itself, that it is a temporary design and not published.
 *
 * The drawing engine understands a subset of CSS: every box with more than
 * one child is a flex box, there is no grid and no column layout, and text is
 * measured by `text.ts` before it is placed, because nothing here scrolls.
 */
/* eslint-disable @next/next/no-img-element -- next/og draws plain <img> into a
   PNG; there is no page and no loader here for next/image to optimise */
import type { ReactElement, ReactNode } from "react";
import { capacity, fitParagraphs, pickQuote, shorten, upperTr } from "./text";

export const PAGE_WIDTH = 1240;
export const PAGE_HEIGHT = 1754;

/** The site's own palette (site.css, D-112). */
const WINE = "#6d1e2e";
const NIGHT = "#360b13";
const STRIP = "#400714";
const INK = "#420a14";
const PAPER = "#ded2c7";
const RULE = "#7b3444";
const MUTED = "#75625e";

export const FONT = {
  caps: "Bodoni Moda",
  italic: "Cormorant Garamond",
  body: "Source Serif 4",
} as const;

export const TEMPORARY_NOTE = "GEÇİCİ TASARIM — YAYIMLANMADI";
export const SELECTION_NOTE = "Önizleme seçkisi: yazının yalnızca bir bölümü. Metin paneldeki kayıttan alındı, değiştirilmedi.";

/* ------------------------------------------------------------------ */
/* What a page is given                                                */
/* ------------------------------------------------------------------ */

export type PreviewPhoto = { src: string; credit: string; description: string };

export type PreviewArticle = {
  title: string;
  byline: string;
  category: string | null;
  paragraphs: string[];
};

export type PreviewIssue = { number: number; title: string; theme: string | null };

export type PreviewPick = { kind: string; title: string; credit: string; year: number; text: string };

/** A clickable area, in page pixels, and what the service should make of it. */
export type AreaSpec =
  | { kind: "page"; target: string; name: string; rect: Rect }
  | { kind: "link"; url: string; name: string; rect: Rect }
  | { kind: "info"; title: string; body: string; name: string; rect: Rect }
  | { kind: "quiz"; name: string; rect: Rect };

export type Rect = { x: number; y: number; w: number; h: number };

export type DrawnPage = {
  element: ReactElement;
  areas: AreaSpec[];
  /** Every word the picture shows, for screen readers (the page's transcript). */
  transcript: string;
  alt: string;
};

/* ------------------------------------------------------------------ */
/* Shared furniture                                                    */
/* ------------------------------------------------------------------ */

function issueLine(issue: PreviewIssue): string {
  return `postscript · Sayı ${String(issue.number).padStart(2, "0")} · ${issue.title}`;
}

/** The band every temporary page carries at its top edge. */
function Stamp({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: PAGE_WIDTH,
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: dark ? "rgba(54, 11, 19, 0.82)" : NIGHT,
        color: PAPER,
        fontFamily: FONT.body,
        fontSize: 20,
        letterSpacing: 5,
      }}
    >
      {`${TEMPORARY_NOTE} · YALNIZCA YÖNETİCİLER`}
    </div>
  );
}

function Folio({ issue, number, light = false }: { issue: PreviewIssue; number: number; light?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 44,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 16,
        borderTop: `1px solid ${light ? "rgba(222, 210, 199, 0.4)" : RULE}`,
        color: light ? PAPER : MUTED,
        fontFamily: FONT.body,
        fontSize: 20,
        letterSpacing: 2,
      }}
    >
      <span>{issueLine(issue)}</span>
      <span>{String(number)}</span>
    </div>
  );
}

function Page({ background, color, children }: { background: string; color: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        background,
        color,
        fontFamily: FONT.body,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/** A block of paragraphs, already cut to fit by `fitParagraphs`. */
function Paragraphs({
  paragraphs,
  width,
  fontSize,
  lineHeight,
  color = INK,
}: {
  paragraphs: string[];
  width: number;
  fontSize: number;
  lineHeight: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, color }}>
      {paragraphs.map((paragraph, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            fontSize,
            lineHeight,
            marginBottom: Math.round(fontSize * 0.7),
            textAlign: "justify",
          }}
        >
          {paragraph}
        </div>
      ))}
    </div>
  );
}

function SelectionTag({ light = false }: { light?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        padding: "6px 14px",
        border: `1px solid ${light ? PAPER : WINE}`,
        color: light ? PAPER : WINE,
        fontSize: 18,
        letterSpacing: 3,
      }}
    >
      ÖNİZLEME SEÇKİSİ
    </div>
  );
}

/** The little "i" drawn where an information area opens. */
function InfoMark({ label, light = false }: { label: string; light?: boolean }) {
  const color = light ? PAPER : WINE;
  return (
    <div style={{ display: "flex", alignItems: "center", color, fontSize: 20, letterSpacing: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          marginRight: 10,
          borderRadius: 17,
          border: `2px solid ${color}`,
          fontFamily: FONT.caps,
          fontSize: 20,
        }}
      >
        i
      </div>
      {label}
    </div>
  );
}

/** Headline size by length, so a long title gets smaller rather than cut. */
function headlineSize(title: string, sizes: [number, number, number]): number {
  if (title.length <= 28) return sizes[0];
  if (title.length <= 60) return sizes[1];
  return sizes[2];
}

function categoryLabel(article: PreviewArticle): string {
  return upperTr(article.category ?? "PostScript");
}

/* ------------------------------------------------------------------ */
/* 1 · Typographic cover                                               */
/* ------------------------------------------------------------------ */

export function coverPage(input: {
  issue: PreviewIssue;
  featured: PreviewArticle[];
}): DrawnPage {
  const { issue, featured } = input;
  const theme =
    issue.theme && issue.theme.toLocaleLowerCase("tr") !== issue.title.toLocaleLowerCase("tr")
      ? issue.theme
      : null;

  const element = (
    <Page background={WINE} color={PAPER}>
      <Stamp />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 130 }}>
        <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 150, letterSpacing: -2, lineHeight: 1 }}>
          postscript
        </div>
        <div style={{ display: "flex", marginTop: 26, width: 900, height: 2, background: PAPER }} />
        <div style={{ display: "flex", marginTop: 8, width: 900, height: 1, background: PAPER }} />
        <div style={{ display: "flex", marginTop: 22, fontSize: 24, letterSpacing: 10 }}>
          {`SAYI ${String(issue.number).padStart(2, "0")}`}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 170 }}>
        <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 176, letterSpacing: 6, lineHeight: 1 }}>
          {issue.title.toUpperCase()}
        </div>
        {theme && (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: FONT.italic,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: 92,
            }}
          >
            {theme}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          bottom: 150,
          display: "flex",
          flexDirection: "column",
          borderTop: `1px solid rgba(222, 210, 199, 0.55)`,
          paddingTop: 30,
        }}
      >
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, marginBottom: 18 }}>BU SAYIDA</div>
        {featured.map((article, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", marginBottom: 22 }}>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, opacity: 0.8 }}>
              {categoryLabel(article)}
            </div>
            <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 38, lineHeight: 1.15 }}>
              {shorten(article.title, 70)}
            </div>
            <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 30 }}>
              {article.byline}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: PAGE_WIDTH,
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: NIGHT,
          fontSize: 20,
          letterSpacing: 5,
        }}
      >
        {TEMPORARY_NOTE}
      </div>
    </Page>
  );

  const transcript = [
    TEMPORARY_NOTE,
    `postscript — Sayı ${issue.number}`,
    theme ? `${issue.title} — ${theme}` : issue.title,
    "Bu sayıda:",
    ...featured.map((article) => `${article.category ?? ""} — ${article.title} — ${article.byline}`),
  ].join("\n");

  return {
    element,
    areas: [],
    transcript,
    alt: `Geçici tipografik kapak: postscript, Sayı ${issue.number}, ${issue.title}`,
  };
}

/* ------------------------------------------------------------------ */
/* 2 · Contents                                                        */
/* ------------------------------------------------------------------ */

export type ContentsEntry = {
  /** The slot the row jumps to; the service turns it into a page id. */
  target: string;
  page: number;
  kicker: string;
  title: string;
  byline: string | null;
};

const CONTENTS_TOP = 400;
const CONTENTS_ROW = 196;
const PLAYLIST_BOX: Rect = { x: 90, y: 1330, w: 1060, h: 190 };

export function contentsPage(input: {
  issue: PreviewIssue;
  number: number;
  entries: ContentsEntry[];
  playlist: { name: string | null; url: string | null };
}): DrawnPage {
  const { issue, number, entries, playlist } = input;

  const element = (
    <Page background={PAPER} color={INK}>
      <Stamp />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 150, marginLeft: 90 }}>
        <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 84, letterSpacing: 8, color: WINE }}>
          İÇİNDEKİLER
        </div>
        <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 40 }}>
          {`Sayı ${String(issue.number).padStart(2, "0")} — ${issue.title}`}
        </div>
      </div>

      {entries.map((entry, index) => (
        <div
          key={entry.target}
          style={{
            position: "absolute",
            left: 90,
            top: CONTENTS_TOP + index * CONTENTS_ROW,
            width: 1060,
            height: CONTENTS_ROW - 16,
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${RULE}`,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 150,
              fontFamily: FONT.caps,
              fontSize: 92,
              color: WINE,
              lineHeight: 1,
            }}
          >
            {String(entry.page).padStart(2, "0")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: 830 }}>
            <div style={{ display: "flex", fontSize: 19, letterSpacing: 4, color: MUTED }}>{entry.kicker}</div>
            <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 38, lineHeight: 1.15 }}>
              {shorten(entry.title, 80)}
            </div>
            {entry.byline && (
              <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 30 }}>
                {entry.byline}
              </div>
            )}
          </div>
          <div style={{ display: "flex", width: 80, justifyContent: "flex-end", fontSize: 44, color: WINE }}>→</div>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: PLAYLIST_BOX.x,
          top: PLAYLIST_BOX.y,
          width: PLAYLIST_BOX.w,
          height: PLAYLIST_BOX.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 44px",
          background: NIGHT,
          color: PAPER,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 19, letterSpacing: 5 }}>SAYININ ÇALMA LİSTESİ</div>
          <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 46 }}>
            {playlist.name ?? issue.title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 2 }}>
          {playlist.url ? "Spotify'da aç ↗" : "Henüz hazır değil"}
        </div>
      </div>

      <Folio issue={issue} number={number} />
    </Page>
  );

  const areas: AreaSpec[] = entries.map((entry, index) => ({
    kind: "page",
    target: entry.target,
    name: `İçindekiler: ${shorten(entry.title, 60)}`,
    rect: { x: 90, y: CONTENTS_TOP + index * CONTENTS_ROW, w: 1060, h: CONTENTS_ROW - 16 },
  }));
  if (playlist.url) {
    areas.push({ kind: "link", url: playlist.url, name: "Sayının çalma listesi (Spotify)", rect: PLAYLIST_BOX });
  }

  const transcript = [
    TEMPORARY_NOTE,
    "İçindekiler",
    ...entries.map((entry) => `${entry.page}. sayfa — ${entry.kicker} — ${entry.title}${entry.byline ? ` — ${entry.byline}` : ""}`),
    `Sayının çalma listesi: ${playlist.name ?? issue.title}`,
  ].join("\n");

  return { element, areas, transcript, alt: `İçindekiler, Sayı ${issue.number}` };
}

/* ------------------------------------------------------------------ */
/* 3 · Picture-led opening                                             */
/* ------------------------------------------------------------------ */

const OPENING_PHOTO_HEIGHT = 1060;
const OPENING_INFO: Rect = { x: 820, y: 1640, w: 340, h: 60 };

/** Returns the page and how many paragraphs it used, for the page after it. */
export function openingPage(input: {
  issue: PreviewIssue;
  number: number;
  article: PreviewArticle;
  photo: PreviewPhoto;
  photoInfo: { title: string; body: string };
}): DrawnPage & { used: number } {
  const { issue, number, article, photo } = input;
  const size = headlineSize(article.title, [104, 80, 62]);
  const textBox = { width: 1060, height: 330, fontSize: 30, lineHeight: 1.5 };
  const fitted = fitParagraphs(article.paragraphs, 0, textBox);

  const element = (
    <Page background={PAPER} color={INK}>
      <img
        alt=""
        src={photo.src}
        width={PAGE_WIDTH}
        height={OPENING_PHOTO_HEIGHT}
        style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: PAGE_WIDTH,
          height: OPENING_PHOTO_HEIGHT,
          display: "flex",
          backgroundImage: "linear-gradient(180deg, rgba(54,11,19,0) 35%, rgba(54,11,19,0.92) 100%)",
        }}
      />
      <Stamp dark />
      <div
        style={{
          position: "absolute",
          left: 90,
          width: 1060,
          bottom: PAGE_HEIGHT - OPENING_PHOTO_HEIGHT + 50,
          display: "flex",
          flexDirection: "column",
          color: PAPER,
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, marginBottom: 14 }}>{categoryLabel(article)}</div>
        <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: size, lineHeight: 1.05 }}>{article.title}</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 24,
          top: OPENING_PHOTO_HEIGHT - 36,
          display: "flex",
          color: PAPER,
          fontSize: 17,
          opacity: 0.85,
        }}
      >
        {photo.credit}
      </div>

      <div
        style={{
          position: "absolute",
          top: OPENING_PHOTO_HEIGHT + 44,
          left: 90,
          width: 1060,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26 }}>
          <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 44, color: WINE }}>
            {article.byline}
          </div>
          <SelectionTag />
        </div>
        <Paragraphs paragraphs={fitted.paragraphs} width={textBox.width} fontSize={textBox.fontSize} lineHeight={textBox.lineHeight} />
      </div>

      <div
        style={{
          position: "absolute",
          left: OPENING_INFO.x,
          top: OPENING_INFO.y,
          width: OPENING_INFO.w,
          height: OPENING_INFO.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <InfoMark label="Görsel ve kaynak" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 1655,
          display: "flex",
          fontSize: 20,
          color: MUTED,
          letterSpacing: 2,
        }}
      >
        {`${issueLine(issue)} · ${number}`}
      </div>
    </Page>
  );

  return {
    element,
    used: fitted.used,
    areas: [
      {
        kind: "info",
        title: input.photoInfo.title,
        body: input.photoInfo.body,
        name: "Görsel ve kaynak bilgisi",
        rect: OPENING_INFO,
      },
    ],
    transcript: [
      TEMPORARY_NOTE,
      categoryLabel(article),
      article.title,
      article.byline,
      ...fitted.paragraphs,
      SELECTION_NOTE,
      photo.credit,
    ].join("\n"),
    alt: `Yazı açılışı: ${article.title}. Fotoğraf: ${photo.description}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 4 · A comfortable continuation page                                 */
/* ------------------------------------------------------------------ */

const NOTE_BOX: Rect = { x: 90, y: 1470, w: 1060, h: 150 };

export function continuedPage(input: {
  issue: PreviewIssue;
  number: number;
  article: PreviewArticle;
  from: number;
  photo: PreviewPhoto;
  noteInfo: { title: string; body: string };
}): DrawnPage {
  const { issue, number, article, photo } = input;
  const rest = article.paragraphs.slice(input.from);
  const quote = pickQuote(rest.length > 0 ? rest : article.paragraphs);

  const column = { width: 505, fontSize: 27, lineHeight: 1.55 };
  const quoteHeight = quote ? 250 : 0;
  const columnTop = 190 + quoteHeight;
  const leftBox = { ...column, height: NOTE_BOX.y - 40 - columnTop };
  const photoHeight = 420;
  const rightBox = { ...column, height: NOTE_BOX.y - 40 - columnTop - photoHeight - 40 };

  const left = fitParagraphs(article.paragraphs, input.from, leftBox);
  const right = left.complete
    ? { paragraphs: [], used: 0, complete: true }
    : fitParagraphs(article.paragraphs, input.from + left.used, rightBox);

  const element = (
    <Page background={PAPER} color={INK}>
      <Stamp />
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 90,
          width: 1060,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 19,
          letterSpacing: 4,
          color: MUTED,
          paddingBottom: 14,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <span>{categoryLabel(article)}</span>
        <span>{upperTr(shorten(article.title, 48))}</span>
      </div>

      {quote && (
        <div
          style={{
            position: "absolute",
            top: 170,
            left: 150,
            width: 940,
            height: quoteHeight - 30,
            display: "flex",
            alignItems: "center",
            fontFamily: FONT.italic,
            fontStyle: "italic",
            fontSize: quote.length > 130 ? 42 : 50,
            lineHeight: 1.2,
            color: WINE,
            textAlign: "center",
            justifyContent: "center",
          }}
        >
          {`“${quote}”`}
        </div>
      )}

      <div style={{ position: "absolute", top: columnTop, left: 90, display: "flex" }}>
        <Paragraphs paragraphs={left.paragraphs} width={column.width} fontSize={column.fontSize} lineHeight={column.lineHeight} />
      </div>
      <div style={{ position: "absolute", top: columnTop, left: 645, display: "flex", flexDirection: "column" }}>
        <Paragraphs paragraphs={right.paragraphs} width={column.width} fontSize={column.fontSize} lineHeight={column.lineHeight} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 645,
          top: NOTE_BOX.y - 40 - photoHeight,
          width: column.width,
          height: photoHeight,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <img alt="" src={photo.src} width={column.width} height={photoHeight - 34} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", marginTop: 8, fontSize: 17, color: MUTED }}>{photo.credit}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: NOTE_BOX.x,
          top: NOTE_BOX.y,
          width: NOTE_BOX.w,
          height: NOTE_BOX.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 34px",
          border: `2px solid ${WINE}`,
        }}
      >
        <div style={{ display: "flex", width: 720, fontSize: 22, lineHeight: 1.4 }}>{SELECTION_NOTE}</div>
        <InfoMark label="Ek bilgi" />
      </div>

      <Folio issue={issue} number={number} />
    </Page>
  );

  const shown = [...left.paragraphs, ...right.paragraphs];
  return {
    element,
    areas: [
      { kind: "info", title: input.noteInfo.title, body: input.noteInfo.body, name: "Önizleme seçkisi hakkında", rect: NOTE_BOX },
    ],
    transcript: [TEMPORARY_NOTE, article.title, quote ? `Alıntı: ${quote}` : "", ...shown, SELECTION_NOTE, photo.credit]
      .filter(Boolean)
      .join("\n"),
    alt: `${article.title} — devam sayfası. Fotoğraf: ${photo.description}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 5 · A second article, picture above and text below                  */
/* ------------------------------------------------------------------ */

const SECOND_PHOTO_HEIGHT = 700;
const SECOND_INFO: Rect = { x: 820, y: 1590, w: 330, h: 60 };

export function secondArticlePage(input: {
  issue: PreviewIssue;
  number: number;
  article: PreviewArticle;
  photo: PreviewPhoto;
  photoInfo: { title: string; body: string };
}): DrawnPage {
  const { issue, number, article, photo } = input;
  const size = headlineSize(article.title, [84, 66, 52]);
  const titleLines = Math.ceil((article.title.length * size * 0.5) / 1060);
  const bodyTop = SECOND_PHOTO_HEIGHT + 120 + titleLines * size * 1.1 + 70;
  const column = { width: 505, fontSize: 26, lineHeight: 1.55, height: SECOND_INFO.y - 30 - bodyTop };
  const left = fitParagraphs(article.paragraphs, 0, column);
  const right = left.complete
    ? { paragraphs: [], used: 0, complete: true }
    : fitParagraphs(article.paragraphs, left.used, column);

  const element = (
    <Page background={PAPER} color={INK}>
      <img
        alt=""
        src={photo.src}
        width={PAGE_WIDTH}
        height={SECOND_PHOTO_HEIGHT}
        style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
      />
      <Stamp dark />
      <div
        style={{
          position: "absolute",
          right: 24,
          top: SECOND_PHOTO_HEIGHT - 34,
          display: "flex",
          color: PAPER,
          fontSize: 17,
        }}
      >
        {photo.credit}
      </div>

      <div
        style={{
          position: "absolute",
          top: SECOND_PHOTO_HEIGHT + 50,
          left: 90,
          width: 1060,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 6, color: WINE }}>{categoryLabel(article)}</div>
          <SelectionTag />
        </div>
        <div style={{ display: "flex", marginTop: 16, fontFamily: FONT.caps, fontSize: size, lineHeight: 1.1 }}>
          {article.title}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontFamily: FONT.italic, fontStyle: "italic", fontSize: 38, color: WINE }}>
          {article.byline}
        </div>
      </div>

      <div style={{ position: "absolute", top: bodyTop, left: 90, display: "flex" }}>
        <Paragraphs paragraphs={left.paragraphs} width={column.width} fontSize={column.fontSize} lineHeight={column.lineHeight} />
      </div>
      <div style={{ position: "absolute", top: bodyTop, left: 645, display: "flex" }}>
        <Paragraphs paragraphs={right.paragraphs} width={column.width} fontSize={column.fontSize} lineHeight={column.lineHeight} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 90,
          top: SECOND_INFO.y,
          width: 700,
          height: SECOND_INFO.h,
          display: "flex",
          alignItems: "center",
          fontSize: 19,
          color: MUTED,
        }}
      >
        Önizleme seçkisi · yazının yalnızca başı
      </div>
      <div
        style={{
          position: "absolute",
          left: SECOND_INFO.x,
          top: SECOND_INFO.y,
          width: SECOND_INFO.w,
          height: SECOND_INFO.h,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <InfoMark label="Görsel ve kaynak" />
      </div>
      <Folio issue={issue} number={number} />
    </Page>
  );

  return {
    element,
    areas: [
      { kind: "info", title: input.photoInfo.title, body: input.photoInfo.body, name: "Görsel ve kaynak bilgisi", rect: SECOND_INFO },
    ],
    transcript: [
      TEMPORARY_NOTE,
      categoryLabel(article),
      article.title,
      article.byline,
      ...left.paragraphs,
      ...right.paragraphs,
      SELECTION_NOTE,
      photo.credit,
    ].join("\n"),
    alt: `${article.title}. Fotoğraf: ${photo.description}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 6 · A controlled collage                                            */
/* ------------------------------------------------------------------ */

const COLLAGE_INFO: Rect = { x: 90, y: 1600, w: 420, h: 56 };

/** Three prints, placed by hand: fixed angles, nothing random between runs. */
const PRINTS = [
  { left: 90, top: 470, width: 600, height: 450, rotate: -3.5 },
  { left: 610, top: 420, width: 520, height: 390, rotate: 2.5 },
  { left: 470, top: 800, width: 420, height: 500, rotate: -1.5 },
] as const;

export function collagePage(input: {
  issue: PreviewIssue;
  number: number;
  article: PreviewArticle;
  photos: PreviewPhoto[];
  photoInfo: { title: string; body: string };
}): DrawnPage {
  const { issue, number, article, photos } = input;
  const size = headlineSize(article.title, [96, 70, 54]);
  const card = { width: 1000, height: 250, fontSize: 25, lineHeight: 1.5 };
  const fitted = fitParagraphs(article.paragraphs, 0, card);

  const element = (
    <Page background={NIGHT} color={PAPER}>
      <Stamp />
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 90,
          width: 1060,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 21, letterSpacing: 6 }}>{categoryLabel(article)}</div>
          <SelectionTag light />
        </div>
        <div style={{ display: "flex", marginTop: 14, fontFamily: FONT.caps, fontSize: size, lineHeight: 1.05 }}>
          {article.title}
        </div>
        <div style={{ display: "flex", marginTop: 8, fontFamily: FONT.italic, fontStyle: "italic", fontSize: 40 }}>
          {article.byline}
        </div>
      </div>

      {photos.slice(0, PRINTS.length).map((photo, index) => {
        const print = PRINTS[index]!;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: print.left,
              top: print.top,
              width: print.width,
              height: print.height,
              display: "flex",
              padding: 16,
              background: PAPER,
              transform: `rotate(${print.rotate}deg)`,
              boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            }}
          >
            <img alt="" src={photo.src} width={print.width - 32} height={print.height - 32} style={{ objectFit: "cover" }} />
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 90,
          top: 1320,
          width: 1060,
          height: 262,
          display: "flex",
          padding: "24px 30px",
          background: PAPER,
          color: INK,
        }}
      >
        <Paragraphs paragraphs={fitted.paragraphs} width={card.width} fontSize={card.fontSize} lineHeight={card.lineHeight} />
      </div>

      <div
        style={{
          position: "absolute",
          left: COLLAGE_INFO.x,
          top: COLLAGE_INFO.y,
          width: COLLAGE_INFO.w,
          height: COLLAGE_INFO.h,
          display: "flex",
          alignItems: "center",
        }}
      >
        <InfoMark label="Görseller ve kaynakları" light />
      </div>
      <div
        style={{
          position: "absolute",
          right: 90,
          top: COLLAGE_INFO.y,
          height: COLLAGE_INFO.h,
          width: 620,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          fontSize: 16,
          opacity: 0.8,
          textAlign: "right",
        }}
      >
        {photos.map((photo) => photo.credit.replace(/^Fotoğraf: /, "")).join(" · ")}
      </div>
      <Folio issue={issue} number={number} light />
    </Page>
  );

  return {
    element,
    areas: [
      { kind: "info", title: input.photoInfo.title, body: input.photoInfo.body, name: "Görseller ve kaynakları", rect: COLLAGE_INFO },
    ],
    transcript: [
      TEMPORARY_NOTE,
      categoryLabel(article),
      article.title,
      article.byline,
      ...fitted.paragraphs,
      SELECTION_NOTE,
      ...photos.map((photo) => photo.credit),
    ].join("\n"),
    alt: `Kolaj sayfası: ${article.title}. ${photos.map((photo) => photo.description).join("; ")}.`,
  };
}

/* ------------------------------------------------------------------ */
/* 7 · Picks and the trial quiz                                        */
/* ------------------------------------------------------------------ */

const QUIZ_BOX: Rect = { x: 90, y: 1150, w: 640, h: 380 };
const PICKS_PLAYLIST_BOX: Rect = { x: 760, y: 1150, w: 390, h: 380 };

export function picksPage(input: {
  issue: PreviewIssue;
  number: number;
  picks: PreviewPick[];
  playlist: { name: string | null; url: string | null };
}): DrawnPage {
  const { issue, number, picks, playlist } = input;
  const cardWidth = 515;
  const cardHeight = 420;

  const element = (
    <Page background={PAPER} color={INK}>
      <Stamp />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 120, marginLeft: 90 }}>
        <div style={{ display: "flex", fontFamily: FONT.caps, fontSize: 72, letterSpacing: 6, color: WINE }}>
          SAYININ SEÇKİSİ
        </div>
        <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 36 }}>
          film, dizi, kitap ve eser
        </div>
      </div>

      {picks.slice(0, 4).map((pick, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: 90 + (index % 2) * (cardWidth + 30),
            top: 300 + Math.floor(index / 2) * (cardHeight + 25),
            width: cardWidth,
            height: cardHeight,
            display: "flex",
            flexDirection: "column",
            padding: "26px 28px",
            border: `1px solid ${RULE}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: WINE }}>{upperTr(pick.kind)}</div>
          <div style={{ display: "flex", marginTop: 8, fontFamily: FONT.caps, fontSize: 38, lineHeight: 1.1 }}>
            {shorten(pick.title, 40)}
          </div>
          <div style={{ display: "flex", fontFamily: FONT.italic, fontStyle: "italic", fontSize: 28, marginBottom: 12 }}>
            {`${pick.credit} · ${pick.year}`}
          </div>
          <div style={{ display: "flex", fontSize: 21, lineHeight: 1.45 }}>
            {shorten(pick.text, capacity({ width: cardWidth - 56, height: cardHeight - 190, fontSize: 21, lineHeight: 1.45 }))}
          </div>
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: QUIZ_BOX.x,
          top: QUIZ_BOX.y,
          width: QUIZ_BOX.w,
          height: QUIZ_BOX.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "34px 36px",
          background: WINE,
          color: PAPER,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignSelf: "flex-start", padding: "4px 12px", background: PAPER, color: WINE, fontSize: 18, letterSpacing: 4 }}>
            DENEME TESTİ · ÖRNEK
          </div>
          <div style={{ display: "flex", marginTop: 20, fontFamily: FONT.caps, fontSize: 50, lineHeight: 1.1 }}>
            Okuyucuyu deneyin
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 22, lineHeight: 1.45 }}>
            Üç kısa soru. Sorular yazarlarımıza ait değildir; yalnızca test penceresini denemek için hazırlandı.
          </div>
        </div>
        <div style={{ display: "flex", alignSelf: "flex-start", padding: "10px 22px", border: `2px solid ${PAPER}`, fontSize: 24, letterSpacing: 2 }}>
          Testi aç →
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: PICKS_PLAYLIST_BOX.x,
          top: PICKS_PLAYLIST_BOX.y,
          width: PICKS_PLAYLIST_BOX.w,
          height: PICKS_PLAYLIST_BOX.h,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "34px 30px",
          background: NIGHT,
          color: PAPER,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 4 }}>ÇALMA LİSTESİ</div>
          <div style={{ display: "flex", marginTop: 16, fontFamily: FONT.italic, fontStyle: "italic", fontSize: 46, lineHeight: 1.1 }}>
            {playlist.name ?? issue.title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22 }}>{playlist.url ? "Spotify'da aç ↗" : "Henüz hazır değil"}</div>
      </div>

      <Folio issue={issue} number={number} />
    </Page>
  );

  const areas: AreaSpec[] = [{ kind: "quiz", name: "Deneme testini aç", rect: QUIZ_BOX }];
  if (playlist.url) {
    areas.push({ kind: "link", url: playlist.url, name: "Sayının çalma listesi (Spotify)", rect: PICKS_PLAYLIST_BOX });
  }

  return {
    element,
    areas,
    transcript: [
      TEMPORARY_NOTE,
      "Sayının seçkisi",
      ...picks.map((pick) => `${pick.kind}: ${pick.title} — ${pick.credit}, ${pick.year}. ${pick.text}`),
      "Deneme testi (örnek): Okuyucuyu deneyin. Sorular yazarlarımıza ait değildir.",
      `Çalma listesi: ${playlist.name ?? issue.title}`,
    ].join("\n"),
    alt: "Sayının seçkisi, deneme testi ve çalma listesi",
  };
}

/** Pixels on the page to the reader's fractions of it. */
export function toFractions(rect: Rect): Rect {
  const round = (value: number) => Math.round(value * 10_000) / 10_000;
  return {
    x: round(rect.x / PAGE_WIDTH),
    y: round(rect.y / PAGE_HEIGHT),
    w: round(rect.w / PAGE_WIDTH),
    h: round(rect.h / PAGE_HEIGHT),
  };
}
