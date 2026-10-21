"use client";

/**
 * The reader's page-turning view (D-345): StPageFlip turns the pages, a page
 * can be taken by its corner and dragged over, or swiped on a phone.
 *
 * StPageFlip moves the page elements it is given into its own box and, when
 * it is destroyed, removes the element it was built on. Elements React owns
 * must never be handed to it: React would later try to remove nodes that are
 * no longer where it left them. So every page is a bare element made here,
 * React draws the page into it through a portal, and the book is built on an
 * element made here too. React owns only the empty frame around them.
 *
 * The pages themselves are the reader's own (`renderPage`), unchanged: the
 * picture, its clickable areas and its text for screen readers. Only pages
 * near the open one get their picture, so an issue is not fetched whole.
 *
 * Rendered in the browser only, and built once: the reader gives it a new
 * key when the pages or one/two-page mode change.
 */
import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import type { PageFlip } from "page-flip";
import type { ReaderPage } from "@/lib/issue-reader";

export type FlipbookHandle = {
  next: () => void;
  prev: () => void;
  /** Straight to a page, without the animation: a jump, not a turn. */
  turnTo: (index: number) => void;
};

/** How far from the open page a page still gets its picture. */
const NEAR = 4;

/** A page without a picture of its own is laid out at the magazine's 3:4. */
function pageShape(pages: ReaderPage[]): { width: number; height: number } {
  const sized = pages.find((page) => page.imageWidth && page.imageHeight);
  return sized ? { width: sized.imageWidth!, height: sized.imageHeight! } : { width: 750, height: 1000 };
}

export function MagazineFlipbook({
  ref,
  pages,
  index,
  spread,
  onTurn,
  onFail,
  renderPage,
}: {
  ref: Ref<FlipbookHandle>;
  pages: ReaderPage[];
  index: number;
  /** Two pages side by side; one when false, whatever the screen. */
  spread: boolean;
  /** Called with the page StPageFlip turned to, by a drag or a swipe too. */
  onTurn: (index: number) => void;
  /** Called if the book cannot be built; the reader then shows its plain view. */
  onFail: () => void;
  renderPage: (page: ReaderPage, near: boolean) => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<PageFlip | null>(null);
  // One bare element per page, made outside React (see above)
  const [slots] = useState(() =>
    pages.map(() => {
      const slot = document.createElement("div");
      slot.className = "reader-flip-page";
      return slot;
    }),
  );
  // Where to open; later turns are the book's own
  const [startPage] = useState(index);
  // The callbacks change every render; the book is built once
  const onTurnRef = useRef(onTurn);
  const onFailRef = useRef(onFail);
  useEffect(() => {
    onTurnRef.current = onTurn;
    onFailRef.current = onFail;
  });

  useImperativeHandle(ref, () => {
    /**
     * page-flip 2.0.7 aims its own turns at points of the whole box, not of
     * the page: flipPrev at x = 10, flipNext at y = 1. Where the page does not
     * fill the box (always across, and a phone's single page down) the point
     * is off the page's corner, and with clicks limited to the corners the
     * turn is dropped. The limit is lifted for that one call only.
     */
    const turn = (direction: "next" | "prev") => {
      const book = bookRef.current;
      if (!book) return;
      const settings = book.getSettings();
      settings.disableFlipByClick = false;
      try {
        if (direction === "next") book.flipNext();
        else book.flipPrev();
      } finally {
        settings.disableFlipByClick = true;
      }
    };
    return {
      next: () => turn("next"),
      prev: () => turn("prev"),
      turnTo: (target: number) => bookRef.current?.turnToPage(target),
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    const block = document.createElement("div");
    block.className = "reader-flip-book";
    frame.appendChild(block);

    void import("page-flip")
      .then(({ PageFlip }) => {
        if (cancelled) return;
        const { width, height } = pageShape(pages);
        const book = new PageFlip(block, {
          width,
          height,
          size: "stretch",
          // Wide enough for a page to be drawn at its full size on any screen
          maxWidth: 4000,
          maxHeight: 6000,
          // One page: StPageFlip shows one when the box is narrower than two
          // pages at minWidth, so a single page is asked for with a minWidth
          // no screen reaches. Two pages: portrait is never allowed
          usePortrait: !spread,
          minWidth: spread ? 1 : 100_000,
          minHeight: 1,
          autoSize: false,
          showCover: true,
          startPage,
          flippingTime: 700,
          maxShadowOpacity: 0.45,
          showPageCorners: true,
          // A click on a page is for its areas; only the corners turn on a click
          disableFlipByClick: true,
          clickEventForward: true,
          mobileScrollSupport: true,
        });
        book.loadFromHTML(slots);
        // Loading gives the box a min-width of two pages at minWidth, which for
        // one page is wider than any screen and pushes the page out of sight.
        // The reader's CSS sizes the box; the book then measures it again
        block.style.minWidth = "";
        block.style.minHeight = "";
        book.update();
        book.on("flip", (event) => onTurnRef.current(event.data));
        bookRef.current = book;
      })
      .catch((error: unknown) => {
        console.error("Flipbook could not be built:", error);
        if (!cancelled) onFailRef.current();
      });

    return () => {
      cancelled = true;
      const book = bookRef.current;
      bookRef.current = null;
      try {
        // Removes the block and the slots in it; their React content goes with the portals
        if (book) book.destroy();
        else block.remove();
      } catch {
        block.remove();
      }
    };
  }, [pages, slots, spread, startPage]);

  return (
    <div className="reader-flip" ref={frameRef}>
      {slots.map((slot, at) =>
        createPortal(renderPage(pages[at]!, Math.abs(at - index) <= NEAR), slot, pages[at]!.id),
      )}
    </div>
  );
}
