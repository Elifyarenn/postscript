"use client";

/**
 * A horizontal rail that opens scrolled to its end on a wide screen (D-116).
 *
 * The front page design shows the artwork and the playlist whole, with the
 * book card slipping off the left edge. On a phone the rail starts at the
 * first card, as a swipe list should.
 */
import { useEffect, useRef, type ReactNode } from "react";

export function RailEnd({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = ref.current;
    if (!rail || !window.matchMedia("(min-width: 1000px)").matches) return;

    let touched = false;
    const stop = () => {
      touched = true;
    };
    const toEnd = () => {
      if (!touched) rail.scrollLeft = rail.scrollWidth;
    };

    // Pictures and web fonts arrive after the first paint and widen the cards,
    // so the end keeps moving; follow it until the reader scrolls themselves
    const observer = new ResizeObserver(toEnd);
    Array.from(rail.children).forEach((child) => observer.observe(child));
    toEnd();

    rail.addEventListener("pointerdown", stop);
    rail.addEventListener("wheel", stop, { passive: true });
    rail.addEventListener("keydown", stop);
    return () => {
      observer.disconnect();
      rail.removeEventListener("pointerdown", stop);
      rail.removeEventListener("wheel", stop);
      rail.removeEventListener("keydown", stop);
    };
  }, []);

  return (
    <div ref={ref} className={className} role="region" aria-label={label}>
      {children}
    </div>
  );
}
