"use client";

/**
 * The magazine reader (D-234).
 *
 * The issue is web pages, not a file: the text stays selectable, the pictures
 * stay their own elements and every page is a normal piece of markup. On a
 * wide screen two pages sit side by side like a spread; below that one page at
 * a time; on a phone the same content becomes a single readable column rather
 * than a shrunken page.
 *
 * Only the pages on screen are mounted, so an issue's pictures are not all
 * fetched at once. Where the reader got to is remembered per issue in this
 * browser alone.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  List,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import type { ReaderPage } from "@/lib/issue-reader";
import { IssuePageSheet } from "./issue-page-sheet";

const RESUME_KEY = "ps-reader";

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

export function MagazineReader({
  issueNumber,
  issueTitle,
  theme,
  pages,
  preview,
  startPageId,
  backHref,
}: {
  issueNumber: number;
  issueTitle: string;
  theme: string | null;
  pages: ReaderPage[];
  preview: boolean;
  /** A page named in the address, so a link can open at the right place. */
  startPageId: string | null;
  backHref: string;
}) {
  // The address decides where to open, and it is a prop, so the first render
  // is the same on the server and in the browser
  const [index, setIndex] = useState(() => {
    const asked = startPageId ? pages.findIndex((page) => page.id === startPageId) : -1;
    return asked >= 0 ? asked : 0;
  });
  const [spread, setSpread] = useState(false);
  const [flow, setFlow] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const total = pages.length;
  const contents = useMemo(() => pages.filter((page) => page.inContents), [pages]);

  // Two pages side by side only where they genuinely fit; a phone gets the
  // same words as one column instead of a page shrunk past reading size
  useEffect(() => {
    // Lower than it was: with the gutter gap gone the pair needs less room,
    // so a small laptop gets the spread too (D-234)
    const wide = window.matchMedia("(min-width: 960px)");
    const narrow = window.matchMedia("(max-width: 700px)");
    const sync = () => {
      setSpread(wide.matches);
      setFlow(narrow.matches);
    };
    sync();
    wide.addEventListener("change", sync);
    narrow.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      narrow.removeEventListener("change", sync);
    };
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

  const step = spread ? 2 : 1;
  const current = pages[index];

  useEffect(() => {
    if (current) writeResume(issueNumber, current.id);
  }, [current, issueNumber]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total],
  );

  const back = useCallback(() => goTo(index - step), [goTo, index, step]);
  const forward = useCallback(() => goTo(index + step), [goTo, index, step]);

  // The keyboard moves the reader, but not while someone is typing or has
  // selected text they are about to copy
  useEffect(() => {
    if (flow) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
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
      } else if (event.key === "Escape" && contentsOpen) {
        setContentsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, contentsOpen, flow, forward, goTo, total]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    const frame = frameRef.current;
    if (!frame) return;
    // Not every browser allows it; when it refuses the reader simply stays put
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.requestFullscreen?.().catch(() => undefined);
  };

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

  const shown = flow ? pages : pages.slice(index, index + (spread ? 2 : 1));
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <div className="reader" ref={frameRef} data-flow={flow ? "" : undefined}>
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
          {preview && <span className="reader-flag">Önizleme · yayımlanmadı</span>}
        </p>

        <div className="reader-bar-side reader-bar-end">
          {!flow && (
            <button
              type="button"
              className="reader-icon"
              onClick={toggleFullscreen}
              title={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              aria-label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
            >
              {fullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            </button>
          )}
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
                    <span>{page.tocTitle ?? page.heading ?? page.templateLabel}</span>
                    <span className="reader-contents-page">{page.position}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </nav>
      )}

      {/* Offered rather than jumped to: nobody likes a page that moves by
          itself under them (D-234) */}
      {rememberedIndex > 0 && rememberedIndex !== index && (
        <p className="reader-resume">
          <button type="button" onClick={() => goTo(rememberedIndex)}>
            Kaldığınız yerden devam edin — sayfa {pages[rememberedIndex]!.position}
          </button>
        </p>
      )}

      <div className={flow ? "reader-flow" : "reader-stage"} data-spread={spread && !flow ? "" : undefined}>
        {shown.map((page) => (
          <IssuePageSheet key={page.id} page={page} preview={preview} />
        ))}
      </div>

      {!flow && (
        <footer className="reader-foot">
          <button
            type="button"
            className="reader-button"
            onClick={back}
            disabled={index === 0}
            aria-label="Önceki sayfa"
          >
            <ChevronLeft aria-hidden /> Önceki
          </button>

          <div className="reader-progress" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="reader-count" aria-live="polite">
            {index + 1}
            {spread && index + 1 < total ? `–${index + 2}` : ""} / {total}
          </p>

          <button
            type="button"
            className="reader-button"
            onClick={forward}
            disabled={index + step >= total}
            aria-label="Sonraki sayfa"
          >
            Sonraki <ChevronRight aria-hidden />
          </button>
        </footer>
      )}
    </div>
  );
}
