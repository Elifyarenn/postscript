"use client";

/**
 * Keeps every line marked `fit-line` on one line (D-157).
 *
 * The owner's rule: a menu, a tab row, a button or a title never scrolls,
 * never gets cut and never breaks onto a second line at any screen size. When
 * one does not fit its box it is scaled down, as a whole, until it does. CSS
 * `zoom` does the scaling, so the text, its padding and its icons shrink
 * together and nothing has to be restyled in `em`. Nothing is ever scaled up.
 *
 * Only reads and one style property are touched, so the server-rendered page
 * is unchanged; until this runs, `.fit-line` clips instead of overflowing.
 */
import { useEffect } from "react";

const SELECTOR = ".fit-line";

/** Below this the words stop being readable; there is no hiding the fact. */
const MIN_ZOOM = 0.2;

function fit(element: HTMLElement): void {
  element.style.removeProperty("zoom");
  let zoom = 1;

  // Width and scroll width are read from the same element, so their ratio
  // stays right in whatever units the zoom leaves them in
  for (let step = 0; step < 6 && element.scrollWidth > element.clientWidth + 1; step += 1) {
    zoom = Math.max(MIN_ZOOM, zoom * (element.clientWidth / element.scrollWidth) * 0.98);
    element.style.setProperty("zoom", String(zoom));
    if (zoom === MIN_ZOOM) break;
  }
}

export function FitLines() {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.querySelectorAll<HTMLElement>(SELECTOR).forEach(fit);
      });
    };

    run();
    const resize = new ResizeObserver(run);
    resize.observe(document.documentElement);
    // A client-side navigation or a new badge changes the text, not the window
    const content = new MutationObserver(run);
    content.observe(document.body, { childList: true, subtree: true, characterData: true });
    void document.fonts?.ready.then(run);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      content.disconnect();
    };
  }, []);

  return null;
}
