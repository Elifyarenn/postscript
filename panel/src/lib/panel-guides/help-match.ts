/**
 * Path matching for the panel header's help button (D-384). Kept apart from
 * the guide texts so the browser bundle gets this function, not the guides.
 */

/** One path pattern and the section it opens; small enough to send to the browser. */
export type HelpTarget = { pattern: string; href: string };

export function matches(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/")) return pathname.startsWith(pattern);
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

/**
 * The section for `pathname`: the longest matching pattern, the first section
 * on a tie (the guide's order is the reading order). Null on the guide itself.
 */
export function resolveHelpHref(targets: HelpTarget[], guidePath: string, pathname: string): string | null {
  // On any guide page (the main editor can open the category editor's too) the button would only point back
  if (pathname === guidePath || /\/rehber(\/|$)/.test(pathname)) return null;
  let best: HelpTarget | null = null;
  for (const target of targets) {
    if (matches(target.pattern, pathname) && (!best || target.pattern.length > best.pattern.length)) best = target;
  }
  return best?.href ?? guidePath;
}
