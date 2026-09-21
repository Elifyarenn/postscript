"use client";

/**
 * The issue's card rail and its dots (D-225).
 *
 * The cards themselves are rendered on the server and handed in as children;
 * this only adds what needs a browser: which card is in view, a dot per card
 * to jump to it, and the five second step from one to the next.
 *
 * The rail stays an ordinary scroll box, so a mouse wheel, a touch swipe and
 * the keyboard all work as before; the dots are a second way in, not the only
 * one. The step stops while the reader is on the rail — with a pointer or with
 * the keyboard — because text that slides away while it is being read is worse
 * than no movement at all. It never starts for a reader who asked for less
 * motion.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** How long a card holds before the rail moves on. */
const STEP_MS = 5000;

export function IssueCardRail({ count, children }: { count: number; children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  /** The card whose left edge sits nearest the rail's, whatever its width. */
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const left = rail.getBoundingClientRect().left;
    let nearest = 0;
    let best = Infinity;
    Array.from(rail.children).forEach((child, position) => {
      const distance = Math.abs(child.getBoundingClientRect().left - left);
      if (distance < best) {
        best = distance;
        nearest = position;
      }
    });
    setIndex(nearest);
  }, []);

  const goTo = useCallback((position: number, smooth = true) => {
    const rail = railRef.current;
    const child = rail?.children[position];
    if (!rail || !child) return;
    const by = child.getBoundingClientRect().left - rail.getBoundingClientRect().left;
    rail.scrollBy({ left: by, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // A timer per card rather than one repeating one, so a reader who scrolls or
  // picks a dot gets the full five seconds on the card they landed on
  useEffect(() => {
    if (held || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => goTo((index + 1) % count), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, held, count, goTo]);

  const hold = () => setHeld(true);
  const release = () => setHeld(false);

  return (
    <div className="extras-slider">
      <div
        ref={railRef}
        className="extras-rail"
        role="region"
        aria-label="Sayının kartları"
        tabIndex={0}
        onScroll={measure}
        onPointerEnter={hold}
        onPointerLeave={release}
        onFocus={hold}
        onBlur={release}
      >
        {children}
      </div>

      {count > 1 && (
        <div className="rail-dots" role="tablist" aria-label="Kartlar">
          {Array.from({ length: count }, (_, position) => (
            <button
              key={position}
              type="button"
              role="tab"
              className="rail-dot"
              aria-label={`Kart ${position + 1}`}
              aria-selected={position === index}
              onClick={() => goTo(position)}
              onPointerEnter={hold}
              onPointerLeave={release}
              onFocus={hold}
              onBlur={release}
            />
          ))}
        </div>
      )}
    </div>
  );
}
