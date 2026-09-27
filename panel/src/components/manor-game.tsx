"use client";

/**
 * The manor game (D-263): an interactive gothic short story, one room at a
 * time — drawn as one page of the magazine (D-265).
 *
 * The page itself stays put: its paper, running head and folio are the same
 * from the opening to the last line, and only what is printed between them
 * changes. It is the page and nothing around it, so the preview route and,
 * later, the issue's own reader can both stand it on their stage.
 *
 * Only the screen the reader stands in is rendered, and only what the server
 * handed over for it is in memory: the next room is asked for when a door is
 * chosen. There is no "back" button — the text says there is no going back —
 * and no history entries either, so the browser's own back button still
 * leaves the page as it would anywhere else. A reload starts over.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { chooseManorAction, enterManorAction, readManorLoreAction } from "@/app/(reader)/oyun/actions";
import type { ManorCover, ManorSceneView } from "@/services/manor-game";
import { formatIssueNumber } from "@/lib/site";
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

/**
 * The page's way on, set like the rest of the type rather than as a web
 * button: a caps line between rules. Still a real button, with a focus ring.
 */
function PageAction({
  children,
  onClick,
  disabled,
  strong = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  strong?: boolean;
}) {
  return (
    <button type="button" className={cn("manor-action", strong && "manor-action-strong")} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      <span className="manor-action-arrow" aria-hidden>
        →
      </span>
    </button>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ManorGame({
  cover,
  issue,
  folio,
  returnTo,
}: {
  cover: ManorCover;
  /** The issue the page belongs to, for the running head and the folio. */
  issue: { number: number; theme: string };
  /** The page's number in the issue; null until the issue is laid out. */
  folio: number | null;
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
  // Bumped on every new screen: remounts the page's contents (for the
  // entrance) and tells the effect below to move focus, not on the first render
  const [screen, setScreen] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen === 0) return;
    // The page scrolls inside itself on a wide screen and with the stage on a
    // phone; either way the new room starts at its top
    const page = pageRef.current;
    page?.querySelector(".manor-page-body")?.scrollTo({ top: 0 });
    page?.closest(".reader-stage")?.scrollTo({ top: 0 });
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
        wait(reducedMotion() ? 0 : 240),
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

  const mood = moodOf(view);
  const night = view.kind === "play" && view.scene.kind === "ending";
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
        {/* The opening's picture block, as the issue's article openings have
            one: here an engraving on the night ground instead of a photograph */}
        <div className="manor-cover-plate">
          <ManorEmblem mood="hall" className="manor-emblem manor-cover-emblem" />
          <div className="manor-cover-words">
            <p className="manor-section">Eğlence &amp; Dedikodu</p>
            <h1 id="manor-title" ref={headingRef} tabIndex={-1} className="manor-cover-title">
              {cover.title}
            </h1>
          </div>
        </div>

        <div className="manor-cover-text">
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
            <PageAction strong onClick={enter} disabled={pending}>
              {reached.length > 0 ? "Tekrar malikâneye gir" : "Malikâneye gir"}
            </PageAction>
            {reached.length > 0 && (
              <PageAction onClick={() => openLore(null)} disabled={pending}>
                PostScript Malikânesi&apos;nin hikâyesini oku
              </PageAction>
            )}
          </div>
          {tally}
        </div>
      </section>
    );
  } else if (view.kind === "lore") {
    const { lore, back } = view;
    body = (
      <article className="manor-lore" aria-labelledby="manor-lore-title">
        <p className="manor-section">Meraklısına · Ek</p>
        <h1 id="manor-lore-title" ref={headingRef} tabIndex={-1} className="manor-heading">
          {lore.title}
        </h1>
        <div className="manor-text">
          {lore.paragraphs.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-actions">
          <PageAction strong onClick={restart}>
            Tekrar malikâneye gir
          </PageAction>
          <PageAction
            onClick={() => {
              setView(back ? { kind: "play", scene: back } : { kind: "cover" });
              setScreen((value) => value + 1);
            }}
          >
            {back ? "Sona dön" : "Kapıya dön"}
          </PageAction>
        </div>
      </article>
    );
  } else if (view.scene.kind === "ending") {
    const scene = view.scene;
    body = (
      <article className="manor-ending" aria-labelledby="manor-scene-title">
        <ManorEmblem mood="ending" className="manor-emblem manor-ending-emblem" />
        <p className="manor-section manor-ending-mark">Son</p>
        <h1 id="manor-scene-title" ref={headingRef} tabIndex={-1} className="manor-heading">
          {scene.title}
        </h1>
        <div className="manor-text">
          {scene.paragraphs.map((text, at) => (
            <Paragraph key={at} text={text} />
          ))}
        </div>
        <div className="manor-verdict">
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
          <PageAction strong onClick={restart}>
            Tekrar malikâneye gir
          </PageAction>
          <PageAction onClick={() => openLore(scene)} disabled={pending}>
            PostScript Malikânesi&apos;nin hikâyesini oku
          </PageAction>
          {returnTo && (
            <Link href={returnTo.href} className="manor-action">
              <span>{returnTo.label}</span>
              <span className="manor-action-arrow" aria-hidden>
                →
              </span>
            </Link>
          )}
        </div>
      </article>
    );
  } else {
    const scene = view.scene;
    body = (
      <article className="manor-scene" aria-labelledby="manor-scene-title">
        <header className="manor-scene-head">
          <ManorEmblem mood={mood as ManorMood} className="manor-emblem manor-scene-emblem" />
          <div>
            <p className="manor-section">
              <span className="sr-only">{route.length + 1}. karar · </span>
              <span aria-hidden>{roman(route.length + 1)} · </span>PostScript Malikânesi
            </p>
            <h1 id="manor-scene-title" ref={headingRef} tabIndex={-1} className="manor-heading">
              {scene.title}
            </h1>
          </div>
        </header>
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
    <article
      ref={pageRef}
      className={cn("page-sheet manor-page", night && "manor-page-night")}
      data-mood={mood}
      aria-busy={pending}
      aria-label="Lanetli Malikâneden Çıkabilecek Misin?"
    >
      {/* The page's furniture, as on every page of the issue: the section and
          the piece at the top, the issue at the foot */}
      <p className="manor-running-head" aria-hidden>
        <span>Eğlence &amp; Dedikodu</span>
        <span>Lanetli Malikâne</span>
      </p>

      <div className="manor-page-body">
        <div key={screen} className={cn("manor-screen", leaving && "is-leaving")}>
          {body}
        </div>
        {error && (
          <p className="manor-error" role="alert">
            {error} Bir kez daha dene.
          </p>
        )}
      </div>

      <p className="manor-folio">
        <span>postscript · Sayı {formatIssueNumber(issue.number)} · {issue.theme}</span>
        {folio !== null && <span>{folio}</span>}
      </p>
    </article>
  );
}
