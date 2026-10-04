/**
 * Smaller copies of a designed issue page (D-313).
 *
 * A design page is 2456 px wide so small type stays sharp at the reader's 4×
 * zoom, but a phone shows it about 400 px wide and was downloading every byte
 * of it. The copies are made ahead of time (`scripts/issue-design-variants.ts`),
 * stored next to the original under a derived key, and asked for with `?w=`.
 * The full picture stays the original: the reader still gets it when zoomed.
 */

/** A phone at 1.75–2× and a desktop spread page (720); a 3× phone (1280). */
export const PAGE_VARIANT_WIDTHS = [720, 1280] as const;
export type PageVariantWidth = (typeof PAGE_VARIANT_WIDTHS)[number];

/** Only a listed width is honoured; anything else means the original. */
export function parseVariantWidth(value: string | null): PageVariantWidth | null {
  const width = Number(value);
  return (PAGE_VARIANT_WIDTHS as readonly number[]).includes(width) ? (width as PageVariantWidth) : null;
}

/** "on-kapak.webp" → "on-kapak.w720.webp"; the same rule names the stored copy. */
export function variantName(name: string, width: PageVariantWidth): string | null {
  return name.endsWith(".webp") ? `${name.slice(0, -".webp".length)}.w${width}.webp` : null;
}

/**
 * The `srcset` for one page: the copies narrower than the original, then the
 * original itself, so the browser can always reach full resolution.
 */
export function pageSrcSet(url: string, originalWidth: number): string {
  const copies = PAGE_VARIANT_WIDTHS.filter((width) => width < originalWidth).map(
    (width) => `${url}?w=${width} ${width}w`,
  );
  return [...copies, `${url} ${originalWidth}w`].join(", ");
}
