import { Bodoni_Moda, Caveat, Cormorant_Garamond, Source_Serif_4 } from "next/font/google";

/**
 * The magazine frame's three faces (D-112).
 *
 * The designs use Devinne Swash, West Swashy (a trial licence) and Minion,
 * none of which may be served as a web font here. These open Google faces are
 * the closest match, are self-hosted by next/font (no request to Google at
 * runtime, so nothing reaches a third party) and carry the Turkish letters.
 */

/** Body copy and menus; stands in for Minion / Source Serif. */
export const bodyFont = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-body",
});

/** Tall capitals such as "SON YAZILAR" and "BİLDİRİMLER"; stands in for West Swashy. */
export const capsFont = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-caps",
});

/** Hairline italics such as "OBSESSION" and "HAKKINDA"; stands in for Araline. */
export const italicFont = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  style: ["italic"],
  display: "swap",
  variable: "--font-italic",
});

/**
 * The handwritten margin notes of the team avatar builder (D-195). Self-hosted
 * by next/font like the others, so opening the builder sends nothing to Google.
 */
export const noteFont = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-note",
});
