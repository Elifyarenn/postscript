/**
 * Path matching for the panels' help links (D-384, D-386). Kept apart from
 * the guide texts so the browser bundle gets this function, not the guides.
 */

/** One path pattern and the section it opens; small enough to send to the browser. */
export type HelpTarget = { pattern: string; href: string; title: string };

export function matches(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/")) return pathname.startsWith(pattern);
  return pathname === pattern || pathname.startsWith(`${pattern}/`);
}

/**
 * The section for `pathname`: the longest matching pattern, the first section
 * on a tie (the guide's order is the reading order); the guide's top when no
 * section matches. Null on a guide page, where a help link would point back.
 */
export function resolveHelpTarget(
  targets: HelpTarget[],
  guidePath: string,
  pathname: string,
): { href: string; title: string | null } | null {
  // The main editor can open the category editor's guide too, hence any /rehber
  if (pathname === guidePath || /\/rehber(\/|$)/.test(pathname)) return null;
  let best: HelpTarget | null = null;
  for (const target of targets) {
    if (matches(target.pattern, pathname) && (!best || target.pattern.length > best.pattern.length)) best = target;
  }
  return best ? { href: best.href, title: best.title } : { href: guidePath, title: null };
}

export function resolveHelpHref(targets: HelpTarget[], guidePath: string, pathname: string): string | null {
  return resolveHelpTarget(targets, guidePath, pathname)?.href ?? null;
}
