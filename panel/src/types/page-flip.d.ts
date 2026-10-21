/**
 * The part of StPageFlip (`page-flip` 2.0.7) the reader uses (D-345). The
 * package ships no type declarations; these follow its `src/PageFlip.ts` and
 * `src/Settings.ts`.
 */
declare module "page-flip" {
  export type FlipSettings = {
    startPage?: number;
    size?: "fixed" | "stretch";
    width: number;
    height: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  };

  export type FlipEvent<T> = { data: T; object: PageFlip };

  export class PageFlip {
    constructor(element: HTMLElement, settings: FlipSettings);
    loadFromHTML(items: HTMLElement[]): void;
    destroy(): void;
    update(): void;
    turnToPage(page: number): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): "portrait" | "landscape";
    /** The live settings object: a change takes effect on the next call. */
    getSettings(): Required<FlipSettings>;
    on(event: "flip", callback: (event: FlipEvent<number>) => void): PageFlip;
    on(event: "init", callback: (event: FlipEvent<{ page: number; mode: string }>) => void): PageFlip;
    on(event: "changeState", callback: (event: FlipEvent<"user_fold" | "fold_corner" | "flipping" | "read">) => void): PageFlip;
    off(event: string): void;
  }
}
