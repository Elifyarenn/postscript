"use client";

/**
 * The magazine reader (D-234, rebuilt for designed pages in D-240).
 *
 * A page is the picture the designer delivered, shown whole, with the
 * clickable areas the panel drew on top of it. The reader's job is to get out
 * of the way: fit the page to the screen, let it be zoomed and moved, turn
 * pages, and open what an area points at without losing the reader's place.
 *
 * Only the pages on screen are mounted, so an issue's pictures are not all
 * fetched at once. Where the reader got to is remembered per issue in this
 * browser alone, and offered rather than jumped to.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  List,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Scan,
  Square,
  X,
} from "lucide-react";
import type { ReaderHotspot } from "@/lib/issue-hotspots";
import type { ReaderQuiz } from "@/lib/issue-quiz";
import { spreadStartFor, type ReaderPage } from "@/lib/issue-reader";
import { IssuePageImage } from "./issue-page-image";
import { IssuePageSheet } from "./issue-page-sheet";
import { IssueQuizPlayer } from "./issue-quiz-player";

const RESUME_KEY = "ps-reader";
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/** Which page this browser last had open in this issue, if any. */
function readResume(issueNumber: number): string | null {
  try {
    const raw = window.localStorage.getItem(`${RESUME_KEY}:${issueNumber}`);
    return raw === "" ? null : raw;
  } catch {
    // Private windows and blocked storage are not a reason to fail to open
    return null;
  }
}

function writeResume(issueNumber: number, pageId: string): void {
  try {
    window.localStorage.setItem(`${RESUME_KEY}:${issueNumber}`, pageId);
  } catch {
    /* nothing to do: remembering the place is a convenience, not the feature */
  }
}

/** The pages a spread shows: the cover alone, then two at a time. */
function pagesAt(pages: ReaderPage[], start: number, spread: boolean): ReaderPage[] {
  if (!spread || start === 0) return pages.slice(start, start + 1);
  return pages.slice(start, start + 2);
}

export function MagazineReader({
  issueNumber,
  issueTitle,
  theme,
  pages,
  quizzes,
  preview,
  adminOnly,
  startPageId,
  backHref,
}: {
  issueNumber: number;
  issueTitle: string;
  theme: string | null;
  pages: ReaderPage[];
  quizzes: ReaderQuiz[];
  preview: boolean;
  /** The working issue only the admins may open; said plainly, not hidden. */
  adminOnly: boolean;
  /** A page named in the address, so a link can open at the right place. */
  startPageId: string | null;
  backHref: string;
}) {
  // The address decides where to open, and it is a prop, so the first render
  // is the same on the server and in the browser. A link to a page beats
  // whatever this browser remembers.
  const [index, setIndex] = useState(() => {
    const asked = startPageId ? pages.findIndex((page) => page.id === startPageId) : -1;
    return asked >= 0 ? asked : 0;
  });
  const [wide, setWide] = useState(false);
  const [wantSpread, setWantSpread] = useState(true);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [info, setInfo] = useState<ReaderHotspot | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  // Once the reader has moved anywhere, the old place is no longer news
  const [moved, setMoved] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const draggedRef = useRef(false);

  const total = pages.length;
  const spread = wide && wantSpread;
  const contents = useMemo(() => pages.filter((page) => page.inContents), [pages]);
  const quiz = useMemo(
    () => quizzes.find((entry) => entry.id === quizId) ?? null,
    [quizId, quizzes],
  );
  const dialogOpen = info !== null || quiz !== null;

  // Two pages side by side only where they genuinely fit; a phone gets one
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Where this browser left off. Read through the external-store hook rather
  // than an effect, so nothing is set during render and the server renders
  // the same first page every time (D-234).
  const subscribe = useCallback(() => () => undefined, []);
  const remembered = useSyncExternalStore(
    subscribe,
    () => readResume(issueNumber),
    () => null,
  );
  const rememberedIndex = useMemo(
    () => (remembered ? pages.findIndex((page) => page.id === remembered) : -1),
    [pages, remembered],
  );

  const start = spread ? spreadStartFor(index) : index;
  const shown = pagesAt(pages, start, spread);
  const current = pages[index];

  useEffect(() => {
    if (current) writeResume(issueNumber, current.id);
  }, [current, issueNumber]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
      setMoved(true);
      // Turning a page starts it fitted and at the top: carrying a zoom and a
      // scroll position across a page break lands a reader in the middle of
      // something with no way of knowing where they are
      setZoom(1);
      stageRef.current?.scrollTo({ top: 0, left: 0 });
    },
    [total],
  );

  // The spread's first page is worked out from the index rather than taken
  // from a value computed further down: the compiler cannot prove that one
  // will not change, and this is the same arithmetic either way
  const back = useCallback(() => {
    if (!spread) return goTo(index - 1);
    const from = spreadStartFor(index);
    goTo(from <= 1 ? 0 : from - 2);
  }, [goTo, index, spread]);

  const forward = useCallback(() => {
    if (!spread) return goTo(index + 1);
    const from = spreadStartFor(index);
    goTo(from === 0 ? 1 : from + 2);
  }, [goTo, index, spread]);

  const atStart = start === 0;
  const atEnd = spread ? start + shown.length >= total : index >= total - 1;

  const zoomBy = useCallback((factor: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * factor * 100) / 100)));
  }, []);

  // The keyboard moves the reader, but not while someone is typing, and not
  // while a window is open over the page — the arrows belong to that window
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      if (event.key === "Escape") {
        if (info) return setInfo(null);
        if (quizId) return setQuizId(null);
        if (contentsOpen) setContentsOpen(false);
        return;
      }
      if (dialogOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        forward();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        back();
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(total - 1);
      } else if (event.key === "+" || event.key === "=") {
        zoomBy(1.25);
      } else if (event.key === "-") {
        zoomBy(0.8);
      } else if (event.key === "0") {
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, contentsOpen, dialogOpen, forward, goTo, info, quizId, total, zoomBy]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  // Pinching a trackpad and ctrl+wheel both arrive as a wheel event with the
  // ctrl key set; the browser would otherwise zoom the whole site
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 0.89);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const toggleFullscreen = () => {
    const frame = frameRef.current;
    if (!frame) return;
    // Not every browser allows it; when it refuses the reader simply stays put
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.requestFullscreen?.().catch(() => undefined);
  };

  /* -------------------------------------------------------------- */
  /* Moving a zoomed page with the mouse                             */
  /* -------------------------------------------------------------- */

  const onPointerDown = (event: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage || zoom <= 1 || event.pointerType === "touch" || event.button !== 0) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    // A few pixels is a click that wobbled, not a drag
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) draggedRef.current = true;
    stage.scrollLeft = drag.left - dx;
    stage.scrollTop = drag.top - dy;
  };

  const endDrag = () => {
    dragRef.current = null;
    // Cleared on the next tick so the click that follows the drag still sees it
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const suppressClicks = useCallback(() => draggedRef.current, []);

  const openHotspot = useCallback(
    (area: ReaderHotspot) => {
      if (area.kind === "info") return setInfo(area);
      if (area.kind === "quiz" && area.quizId) return setQuizId(area.quizId);
      if (area.kind === "page" && area.targetPageId) {
        const found = pages.findIndex((page) => page.id === area.targetPageId);
        if (found >= 0) goTo(found);
      }
    },
    [goTo, pages],
  );

  if (total === 0) {
    return (
      <div className="reader-empty">
        <p>Bu sayıya henüz sayfa eklenmedi.</p>
        <Link href={backHref} className="reader-button">
          Sayıya dön
        </Link>
      </div>
    );
  }

  const jump = (pageId: string) => {
    const found = pages.findIndex((page) => page.id === pageId);
    if (found >= 0) goTo(found);
    setContentsOpen(false);
  };

  const progress = Math.round(((index + 1) / total) * 100);
  // Offered once, on the way in: a reader who has already turned a page knows
  // where they are and does not want to be sent back (D-240)
  const offerResume =
    !moved && startPageId === null && rememberedIndex > 0 && rememberedIndex !== index;

  return (
    <div className="reader" ref={frameRef} data-zoomed={zoom > 1 ? "" : undefined}>
      <header className="reader-bar">
        <div className="reader-bar-side">
          <Link href={backHref} className="reader-icon" title="Sayıdan çık" aria-label="Sayıdan çık">
            <X aria-hidden />
          </Link>
          <button
            type="button"
            className="reader-icon"
            onClick={() => setContentsOpen((open) => !open)}
            aria-expanded={contentsOpen}
            aria-controls="reader-contents"
            title="İçindekiler"
          >
            <List aria-hidden />
          </button>
        </div>

        <p className="reader-title">
          <span className="reader-issue">Sayı {String(issueNumber).padStart(2, "0")}</span>
          <span className="reader-name">{theme ?? issueTitle}</span>
          {adminOnly ? (
            <span className="reader-flag">Yalnızca yöneticiler · örnek sayı</span>
          ) : (
            preview && <span className="reader-flag">Önizleme · yayımlanmadı</span>
          )}
        </p>

        <div className="reader-bar-side reader-bar-end">
          <span className="reader-zoom" role="group" aria-label="Yakınlaştırma">
            <button
              type="button"
              className="reader-icon"
              onClick={() => zoomBy(0.8)}
              disabled={zoom <= MIN_ZOOM}
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
            >
              <Minus aria-hidden />
            </button>
            <button
              type="button"
              className="reader-icon"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              title="Sayfaya sığdır"
              aria-label="Sayfaya sığdır"
            >
              <Scan aria-hidden />
            </button>
            <button
              type="button"
              className="reader-icon"
              onClick={() => zoomBy(1.25)}
              disabled={zoom >= MAX_ZOOM}
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
            >
              <Plus aria-hidden />
            </button>
          </span>

          {wide && (
            <button
              type="button"
              className="reader-icon"
              onClick={() => setWantSpread((on) => !on)}
              title={wantSpread ? "Tek sayfa görünümü" : "Çift sayfa görünümü"}
              aria-label={wantSpread ? "Tek sayfa görünümü" : "Çift sayfa görünümü"}
              aria-pressed={wantSpread}
            >
              {wantSpread ? <Square aria-hidden /> : <Columns2 aria-hidden />}
            </button>
          )}

          <button
            type="button"
            className="reader-icon"
            onClick={toggleFullscreen}
            title={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
            aria-label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
          >
            {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </button>
        </div>
      </header>

      {contentsOpen && (
        <nav id="reader-contents" className="reader-contents" aria-label="İçindekiler">
          <h2 className="reader-contents-title">İçindekiler</h2>
          {contents.length === 0 ? (
            <p className="reader-contents-empty">İçindekilere girecek sayfa yok.</p>
          ) : (
            <ol>
              {contents.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => jump(page.id)}
                    aria-current={current?.id === page.id ? "true" : undefined}
                  >
                    <span>{page.tocTitle ?? page.heading ?? page.label ?? page.templateLabel}</span>
                    <span className="reader-contents-page">{page.position}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </nav>
      )}

      {offerResume && (
        <p className="reader-resume">
          <button type="button" onClick={() => goTo(rememberedIndex)}>
            <BookOpen aria-hidden /> Kaldığınız yerden devam edin — sayfa{" "}
            {pages[rememberedIndex]!.position}
          </button>
        </p>
      )}

      <div
        className="reader-stage"
        ref={stageRef}
        data-spread={spread && shown.length > 1 ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="reader-pages" style={{ "--zoom": zoom } as React.CSSProperties}>
          {shown.map((page) =>
            page.imageUrl ? (
              <IssuePageImage
                key={page.id}
                page={page}
                onHotspot={openHotspot}
                suppressClicks={suppressClicks}
              />
            ) : (
              // Laid out from a template before D-240 and never given a
              // picture: still shown, so nothing already typed is lost
              <IssuePageSheet key={page.id} page={page} preview={preview} />
            ),
          )}
        </div>
      </div>

      <footer className="reader-foot">
        <button
          type="button"
          className="reader-button"
          onClick={back}
          disabled={atStart}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft aria-hidden /> Önceki
        </button>

        <div className="reader-progress" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="reader-count" aria-live="polite">
          {shown.length > 1 ? `${start + 1}–${start + shown.length}` : index + 1} / {total}
        </p>

        <button
          type="button"
          className="reader-button"
          onClick={forward}
          disabled={atEnd}
          aria-label="Sonraki sayfa"
        >
          Sonraki <ChevronRight aria-hidden />
        </button>
      </footer>

      {info && (
        <div
          className="reader-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={info.infoTitle ?? "Bilgi"}
        >
          <div className="reader-panel">
            <header className="reader-panel-head">
              <h2>{info.infoTitle ?? "Bilgi"}</h2>
              <button
                type="button"
                className="reader-icon"
                onClick={() => setInfo(null)}
                aria-label="Kapat"
              >
                <X aria-hidden />
              </button>
            </header>
            {info.infoImageUrl && (
              <img className="reader-panel-image" src={info.infoImageUrl} alt="" decoding="async" />
            )}
            {info.infoBody && <p className="reader-panel-body">{info.infoBody}</p>}
          </div>
        </div>
      )}

      {quiz && <IssueQuizPlayer quiz={quiz} onClose={() => setQuizId(null)} />}
    </div>
  );
}
