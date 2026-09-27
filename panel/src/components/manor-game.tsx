"use client";

/**
 * The manor game (D-263): an interactive gothic short story, one room at a
 * time, set on one magazine page that never scrolls (D-266).
 *
 * The page keeps its size; each room is fitted onto it. The type first gets
 * smaller, then a long text runs in two columns as a magazine page's would,
 * and only when even that is not enough — a phone, the long endings — does
 * the room continue on the page's next side, turned with "Devam".
 *
 * Only the screen the reader stands in is rendered, and only what the server
 * handed over for it is in memory: the next room is asked for when a door is
 * chosen. There is no "back" button — the text says there is no going back —
 * and no history entries either, so the browser's own back button still
 * leaves the page as it would anywhere else. A reload starts over.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { chooseManorAction, enterManorAction, readManorLoreAction } from "@/app/oyun/actions";
import type { ManorCover, ManorSceneView } from "@/services/manor-game";
import { cn } from "@/lib/utils";
import { ManorEmblem, type ManorMood } from "./manor-emblems";
import "./manor-game.css";

type Lore = { title: string; paragraphs: string[] };

type View =
  | { kind: "cover" }
  | { kind: "play"; scene: ManorSceneView }
  | { kind: "lore"; lore: Lore; back: ManorSceneView | null };

/** The rooms' looks, by scene id; an unknown id falls back to the entrance. */
const MOODS: Record<string, ManorMood> = {
  "giris-kapisi": "hall",
  "portreler-koridoru": "portraits",
  "ikinci-kat": "mirror",
  "balo-salonu": "ballroom",
  "kiler-ve-arka-cikis": "pantry",
  "tozlu-kutuphane": "library",
  "kis-bahcesi": "conservatory",
  "yeralti-gecidi": "tunnel",
};

function moodOf(view: View): ManorMood | "cover" | "lore" {
  if (view.kind !== "play") return view.kind;
  if (view.scene.kind === "ending") return "ending";
  return MOODS[view.scene.id] ?? "hall";
}

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function roman(value: number): string {
  let rest = value;
  let out = "";
  for (const [size, glyph] of ROMAN) {
    while (rest >= size) {
      out += glyph;
      rest -= size;
    }
  }
  return out;
}

/** `**bold**` and `*italic*` as the source writes them; nothing else is markup. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, at) => {
        if (part.startsWith("**") && part.endsWith("**")) return <strong key={at}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={at}>{part.slice(1, -1)}</em>;
        return <span key={at}>{part}</span>;
      })}
    </>
  );
}

/** A lone bold line ("KÜTÜPHANE", "1826") is set large; a lone italic one is a whisper. */
function Paragraph({ text }: { text: string }) {
  if (/^\*\*[^*]+\*\*$/.test(text)) {
    return (
      <p className="manor-display">
        <Inline text={text} />
      </p>
    );
  }
  if (/^\*[^*]+\*$/.test(text)) {
    return (
      <p className="manor-whisper">
        <Inline text={text} />
      </p>
    );
  }
  return (
    <p>
      <Inline text={text} />
    </p>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Fitting a room onto the page                                        */
/* ------------------------------------------------------------------ */

/** The space between two sides of the page when a room runs over. */
const SIDE_GAP = 48;

type Fit = { font: number; columns: 1 | 2; sides: number };

/**
 * Finds the largest type that lets the room fit the page: first in one
 * column down to a comfortable size, then in two columns where the page is
 * wide enough, then one column at the smallest readable size. When nothing
 * fits, the room is laid out in page-wide columns — the page's sides — and
 * the reader turns them. Every step is a real measurement of the page.
 */
function fitRoom(box: HTMLElement, flow: HTMLElement): Fit {
  const width = box.clientWidth;
  const height = box.clientHeight;
  const largest = Math.min(19, Math.max(14, width / 28));
  const smallest = width < 420 ? 13.5 : 13;
  const comfortable = Math.min(largest, 15.5);

  let dense = false;
  const lay = (font: number, columns: 1 | 2, sided: boolean) => {
    flow.style.fontSize = `${font}px`;
    flow.dataset.columns = String(columns);
    if (dense) flow.dataset.dense = "";
    else delete flow.dataset.dense;
    flow.style.height = sided ? `${height}px` : "";
    flow.style.columnWidth = sided ? `${width}px` : "";
    flow.style.columnGap = sided ? `${SIDE_GAP}px` : "";
  };
  const fitsAt = (font: number, columns: 1 | 2) => {
    lay(font, columns, false);
    return flow.scrollHeight <= height + 1;
  };
  const largestFitting = (columns: 1 | 2, floor: number): number | null => {
    if (!fitsAt(floor, columns)) return null;
    let low = floor;
    let high = largest;
    while (high - low > 0.25) {
      const middle = (low + high) / 2;
      if (fitsAt(middle, columns)) low = middle;
      else high = middle;
    }
    return low;
  };

  // In order: one column at a comfortable size; two columns; the same with
  // the paragraphs set closer together; one column at the smallest size
  const wide = width >= 440;
  const tries: { columns: 1 | 2; floor: number; dense: boolean }[] = [
    { columns: 1, floor: comfortable, dense: false },
    ...(wide ? [{ columns: 2 as const, floor: smallest, dense: false }] : []),
    ...(wide ? [{ columns: 2 as const, floor: smallest, dense: true }] : []),
    { columns: 1, floor: smallest, dense: false },
    { columns: 1, floor: smallest, dense: true },
  ];
  let fit: Fit | null = null;
  for (const attempt of tries) {
    dense = attempt.dense;
    const font = largestFitting(attempt.columns, attempt.floor);
    if (font !== null) {
      fit = { font, columns: attempt.columns, sides: 1 };
      break;
    }
  }
  if (!fit) {
    // Nothing fits one side: the room goes on over the page, closely set
    dense = true;
    lay(smallest, 1, true);
    const sides = Math.max(1, Math.round((flow.scrollWidth + SIDE_GAP) / (width + SIDE_GAP)));
    fit = { font: smallest, columns: 1, sides };
  }
  lay(fit.font, fit.columns, fit.sides > 1);
  return fit;
}

export function ManorGame({
  cover,
  returnTo,
}: {
  cover: ManorCover;
  /**
   * Where the ending sends a reader who is done, once the game sits in a
   * published issue. The preview has nowhere honest to send them, so none.
   */
  returnTo?: { href: string; label: string };
}) {
  const [view, setView] = useState<View>({ kind: "cover" });
  const [route, setRoute] = useState<string[]>([]);
  const [reached, setReached] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every new screen: remounts the room (for its entrance), refits
  // it and moves focus to its title, but not on the first render
  const [screen, setScreen] = useState(0);
  const [sides, setSides] = useState(1);
  // Which side of the page is showing, remembered for the room it was turned
  // in: a new room always opens on its first side
  const [turned, setTurned] = useState({ screen: 0, side: 0 });
  const side = turned.screen === screen ? turned.side : 0;
  const setSide = useCallback(
    (next: (current: number) => number) =>
      setTurned((state) => ({ screen, side: next(state.screen === screen ? state.side : 0) })),
    [screen],
  );
  const [sideWidth, setSideWidth] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  // Fitted before the room is painted, and again whenever the page changes size
  useLayoutEffect(() => {
    const box = boxRef.current;
    const flow = flowRef.current;
    if (!box || !flow) return;
    const refit = () => {
      const fit = fitRoom(box, flow);
      setSides(fit.sides);
      setSideWidth(box.clientWidth + SIDE_GAP);
      setSide((current) => Math.min(current, fit.sides - 1));
    };
    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [screen, error, setSide]);

  useEffect(() => {
    if (screen === 0) return;
    // A keyboard or screen reader user lands on the new room's title
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);

  /** Fades the room out while the server answers, then shows the next one. */
  const go = useCallback(
    async <T,>(
      request: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
      apply: (value: T) => void,
    ) => {
      if (pending) return;
      setPending(true);
      setError(null);
      setLeaving(true);
      const [result] = await Promise.all([
        request().catch(() => ({ ok: false as const, error: "Malikânenin kapıları şu an açılmıyor." })),
        wait(reducedMotion() ? 0 : 260),
      ]);
      if (result.ok) {
        apply(result.value);
        setScreen((value) => value + 1);
      } else {
        setError(result.error);
      }
      setLeaving(false);
      setPending(false);
    },
    [pending],
  );

  const enter = () =>
    go(enterManorAction, (scene) => {
      setRoute([]);
      setView({ kind: "play", scene });
    });

  const choose = (scene: ManorSceneView, letter: string) =>
    go(
      () => chooseManorAction({ sceneId: scene.id, letter }),
      (next) => {
        setRoute((steps) => [...steps, letter]);
        if (next.kind === "ending") {
          setReached((ids) => (ids.includes(next.id) ? ids : [...ids, next.id]));
        }
        setView({ kind: "play", scene: next });
      },
    );

  const openLore = (back: ManorSceneView | null) =>
    go(readManorLoreAction, (lore) => setView({ kind: "lore", lore, back }));

  /** Back to the front door: the route and the ending are forgotten, the tally is kept. */
  const restart = () => {
    setRoute([]);
    setError(null);
    setView({ kind: "cover" });
    setScreen((value) => value + 1);
  };

  /** Tabbing to a door on another side of the page turns the page to it. */
  const followFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const flow = flowRef.current;
    if (!flow || sides < 2 || sideWidth === 0) return;
    const offset = event.target.getBoundingClientRect().left - flow.getBoundingClientRect().left;
    setSide(() => Math.max(0, Math.min(sides - 1, Math.floor((offset + 1) / sideWidth))));
  };

  const mood = moodOf(view);
  const tally =
    reached.length > 0 ? (
      <p className="manor-tally">
        Ulaştığın sonlar: {reached.length}/{cover.endingCount}
      </p>
    ) : null;

  let body: ReactNode;
  if (view.kind === "cover") {
    body = (
      <section className="manor-cover" aria-labelledby="manor-title">
        <ManorEmblem mood="hall" className="manor-emblem manor-cover-emblem" />
        <p className="manor-kicker">Eğlence &amp; Dedikodu · Gotizm</p>
        <h1 id="manor-title" ref={headingRef} tabIndex={-1} className="manor-cover-title">
          {cover.title}
        </h1>
        <p className="manor-lede">
          <Inline text={cover.lede} />
        </p>
        <div className="manor-rules">
          <h2>Nasıl oynanır?</h2>
          {cover.howToPlay.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-actions">
          <button type="button" className="manor-button manor-button-primary" onClick={enter} disabled={pending}>
            {reached.length > 0 ? "Tekrar malikâneye gir" : "Malikâneye gir"}
          </button>
          {reached.length > 0 && (
            <button type="button" className="manor-button" onClick={() => openLore(null)} disabled={pending}>
              PostScript Malikânesi&apos;nin hikâyesini oku
            </button>
          )}
        </div>
        {tally}
      </section>
    );
  } else if (view.kind === "lore") {
    const { lore, back } = view;
    body = (
      <article className="manor-lore" aria-labelledby="manor-lore-title">
        <p className="manor-kicker">Meraklısına</p>
        <h1 id="manor-lore-title" ref={headingRef} tabIndex={-1} className="manor-title">
          {lore.title}
        </h1>
        <div className="manor-text">
          {lore.paragraphs.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-actions">
          <button type="button" className="manor-button manor-button-primary" onClick={restart}>
            Tekrar malikâneye gir
          </button>
          <button
            type="button"
            className="manor-button"
            onClick={() => {
              setView(back ? { kind: "play", scene: back } : { kind: "cover" });
              setScreen((value) => value + 1);
            }}
          >
            {back ? "Sona dön" : "Kapıya dön"}
          </button>
        </div>
      </article>
    );
  } else if (view.scene.kind === "ending") {
    const scene = view.scene;
    body = (
      <article className="manor-ending" aria-labelledby="manor-scene-title">
        <div className="manor-head">
          <ManorEmblem mood="ending" className="manor-emblem manor-ending-emblem" />
          <div>
            <p className="manor-kicker">Son</p>
            <h1 id="manor-scene-title" ref={headingRef} tabIndex={-1} className="manor-title">
              {scene.title}
            </h1>
          </div>
        </div>
        <div className="manor-text">
          {scene.paragraphs.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-verdict">
          <p className="manor-verdict-mark" aria-hidden>
            Son
          </p>
          {scene.verdict.map((line, at) => (
            <p key={at}>
              <Inline text={line} />
            </p>
          ))}
        </div>
        <p className="manor-route">
          İzlediğin yol: <span>{route.join(" · ")}</span>
        </p>
        {tally}
        <div className="manor-actions">
          <button type="button" className="manor-button manor-button-primary" onClick={restart}>
            Tekrar malikâneye gir
          </button>
          <button type="button" className="manor-button" onClick={() => openLore(scene)} disabled={pending}>
            PostScript Malikânesi&apos;nin hikâyesini oku
          </button>
          {returnTo && (
            <Link href={returnTo.href} className="manor-button">
              {returnTo.label}
            </Link>
          )}
        </div>
      </article>
    );
  } else {
    const scene = view.scene;
    body = (
      <article className="manor-scene" aria-labelledby="manor-scene-title">
        <div className="manor-head">
          <ManorEmblem mood={mood as ManorMood} className="manor-emblem" />
          <div>
            <p className="manor-kicker">
              <span className="sr-only">{route.length + 1}. karar · </span>
              <span className="manor-step" aria-hidden>
                {roman(route.length + 1)}.
              </span>
              PostScript Malikânesi
            </p>
            <h1 id="manor-scene-title" ref={headingRef} tabIndex={-1} className="manor-title">
              {scene.title}
            </h1>
          </div>
        </div>
        <div className="manor-text">
          {scene.paragraphs.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-choices" role="group" aria-label="Seçimin">
          {scene.choices.map((choice) => (
            <button
              key={choice.letter}
              type="button"
              className="manor-choice"
              onClick={() => choose(scene, choice.letter)}
              disabled={pending}
            >
              <span className="manor-choice-letter">{choice.letter}</span>
              <span className="manor-choice-label">{choice.label}</span>
            </button>
          ))}
        </div>
        <p className="manor-no-return">Geri dönmek yok.</p>
      </article>
    );
  }

  return (
    <div className="manor-game" data-mood={mood} aria-busy={pending}>
      <div className="manor-atmosphere" aria-hidden />
      <div className={cn("manor-sheet", view.kind === "lore" && "manor-sheet-paper")}>
        <div ref={boxRef} className="manor-fit">
          <div key={screen} className={cn("manor-screen", leaving && "is-leaving")}>
            <div
              ref={flowRef}
              className="manor-flow"
              onFocus={followFocus}
              style={sides > 1 ? { transform: `translateX(${-side * sideWidth}px)` } : undefined}
            >
              {body}
            </div>
          </div>
        </div>

        {error && (
          <p className="manor-error" role="alert">
            {error} Bir kez daha dene.
          </p>
        )}

        {/* The page's foot; a room that runs over is turned here */}
        <div className="manor-sheet-foot">
          <span>PostScript · Eğlence &amp; Dedikodu</span>
          {sides > 1 && (
            <span className="manor-turn" role="group" aria-label="Sayfanın yüzleri">
              <button
                type="button"
                className="manor-turn-button"
                onClick={() => setSide((value) => Math.max(0, value - 1))}
                disabled={side === 0}
                aria-label="Önceki yüz"
              >
                ‹
              </button>
              <span className="manor-turn-count" aria-live="polite">
                {side + 1}/{sides}
              </span>
              <button
                type="button"
                className="manor-turn-button manor-turn-next"
                onClick={() => setSide((value) => Math.min(sides - 1, value + 1))}
                disabled={side === sides - 1}
              >
                Devam ›
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
