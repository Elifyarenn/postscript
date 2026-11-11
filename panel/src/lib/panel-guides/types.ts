/** The shape of a panel usage guide (D-384); rendered by `PanelGuideView`. */

/** `**…**` inside a text marks a button or menu label. */
export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string }
  /** A drawing from `panel-guide-figures.tsx`, by name. */
  | { kind: "figure"; name: GuideFigureName; caption: string }
  /** A row of boxes joined by arrows; `loop` is the way back, if there is one. */
  | { kind: "flow"; steps: string[]; caption: string; loop?: string }
  /** Periods one after another, such as an issue's windows. */
  | { kind: "timeline"; segments: { label: string; detail: string }[]; caption: string }
  /** Side-by-side boxes: two roles, two choices and what each leads to. */
  | { kind: "compare"; items: { title: string; tone: GuideTone; points: string[] }[] }
  /** Outside apps and sites; always opened in a new tab. */
  | { kind: "links"; title: string; items: GuideLink[] };

export type GuideTone = "ok" | "warn" | "neutral";

export type GuideFigureName = "signed-pages" | "word-budget";

export type GuideLink = {
  label: string;
  /** https only; a test checks it. */
  href: string;
  /** One line: what it is for, platform, how it treats the file. */
  note: string;
};

export type GuideSection = {
  /** Anchor on the guide page; unique within one guide. */
  id: string;
  title: string;
  /** The panel page the section explains; a test checks that it exists. */
  href?: string;
  /**
   * More paths whose "Bu sayfanın rehberi" button opens this section. A path
   * ending in "/" covers everything under it; the longest match wins.
   */
  pages?: string[];
  /** Who sees this part, when not everyone in the panel does. */
  who?: string;
  blocks: GuideBlock[];
};

export type PanelGuide = {
  title: string;
  intro: string;
  sections: GuideSection[];
};
