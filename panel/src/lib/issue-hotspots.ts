/**
 * The clickable areas drawn on a page image (D-240).
 *
 * A rectangle is stored in fractions of the picture, so it lands on the same
 * part of the design at any size and any zoom. Everything here is pure: the
 * panel, the reader and the service all measure "is this area finished" and
 * "do these two overlap" with the same functions.
 */
import { z } from "zod";

export const HOTSPOT_KINDS = ["link", "page", "info", "quiz"] as const;
export type HotspotKind = (typeof HOTSPOT_KINDS)[number];

export const HOTSPOT_KIND_LABELS: Record<HotspotKind, string> = {
  link: "Dış bağlantı",
  page: "Dergi içi geçiş",
  info: "Bilgi kutusu",
  quiz: "Test",
};

/** Small enough to be a slip of the mouse rather than a decision. */
export const MIN_SIDE = 0.01;

const fraction = z.number().min(0).max(1);

/**
 * Only http and https travel. A `javascript:` or `data:` address is a way to
 * run something in the reader's browser, so it is refused here rather than
 * anywhere later; nothing typed into the panel is ever executed.
 */
export function safeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

export const hotspotInputSchema = z
  .strictObject({
    /** Present when an existing area is being saved; absent for a new one. */
    id: z.uuid().optional(),
    kind: z.enum(HOTSPOT_KINDS),
    name: z.string().trim().max(120).optional().nullable(),
    ariaLabel: z.string().trim().max(200).optional().nullable(),
    showMarker: z.boolean().optional(),
    x: fraction,
    y: fraction,
    w: z.number().min(MIN_SIDE).max(1),
    h: z.number().min(MIN_SIDE).max(1),
    url: z.string().trim().max(2000).optional().nullable(),
    openInNewTab: z.boolean().optional(),
    targetPageId: z.uuid().optional().nullable(),
    infoTitle: z.string().trim().max(200).optional().nullable(),
    infoBody: z.string().trim().max(4000).optional().nullable(),
    infoMediaId: z.uuid().optional().nullable(),
    quizId: z.uuid().optional().nullable(),
  })
  // A rectangle that starts inside the picture but ends outside it would be
  // clipped differently by every browser; keep the whole thing on the page
  .refine((area) => area.x + area.w <= 1.0001 && area.y + area.h <= 1.0001, {
    message: "Alan sayfanın dışına taşıyor.",
  })
  .refine((area) => area.kind !== "link" || safeExternalUrl(area.url ?? "") !== null, {
    message: "Bağlantı adresi geçersiz. Yalnızca http ve https kabul edilir.",
  });

export type HotspotInput = z.infer<typeof hotspotInputSchema>;

export const hotspotListSchema = z.array(hotspotInputSchema).max(60);

/* ------------------------------------------------------------------ */
/* What the reader is handed                                           */
/* ------------------------------------------------------------------ */

export type ReaderHotspot = {
  id: string;
  kind: HotspotKind;
  name: string | null;
  ariaLabel: string | null;
  showMarker: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  url: string | null;
  openInNewTab: boolean;
  targetPageId: string | null;
  infoTitle: string | null;
  infoBody: string | null;
  infoImageUrl: string | null;
  quizId: string | null;
};

/**
 * Whether this area actually does something. An unfinished one is left out of
 * the reader's copy entirely: an area that looks clickable and then does
 * nothing is worse than no area at all.
 */
export function hotspotIsReady(area: {
  kind: HotspotKind;
  url?: string | null;
  targetPageId?: string | null;
  infoTitle?: string | null;
  infoBody?: string | null;
  quizId?: string | null;
}): boolean {
  switch (area.kind) {
    case "link":
      return safeExternalUrl(area.url ?? "") !== null;
    case "page":
      return Boolean(area.targetPageId);
    case "info":
      return Boolean((area.infoTitle ?? "").trim() || (area.infoBody ?? "").trim());
    case "quiz":
      return Boolean(area.quizId);
    default:
      return false;
  }
}

/** Why an area is not finished, in the words the panel shows beside it. */
export function hotspotProblem(area: Parameters<typeof hotspotIsReady>[0]): string | null {
  if (hotspotIsReady(area)) return null;
  switch (area.kind) {
    case "link":
      return "Geçerli bir http/https adresi girin.";
    case "page":
      return "Gidilecek sayfayı seçin.";
    case "info":
      return "Başlık veya açıklama girin.";
    case "quiz":
      return "Bağlanacak testi seçin.";
    default:
      return "Etkileşim türü tanınmadı.";
  }
}

type Rect = { x: number; y: number; w: number; h: number };

/** The shared area of two rectangles, as a fraction of the picture. */
export function overlapArea(a: Rect, b: Rect): number {
  const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (across <= 0 || down <= 0) return 0;
  return across * down;
}

/**
 * Pairs of indices that share more than a hair's breadth. Overlap is allowed —
 * one area on top of another is sometimes the design — but the panel warns,
 * because the one drawn last is the one a reader will hit.
 */
export function overlappingPairs(areas: Rect[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < areas.length; i += 1) {
    for (let j = i + 1; j < areas.length; j += 1) {
      // A shared edge is not an overlap; a shared tenth of a percent is
      if (overlapArea(areas[i]!, areas[j]!) > 0.0001) pairs.push([i, j]);
    }
  }
  return pairs;
}

/** Keeps a rectangle inside the picture while it is being dragged or resized. */
export function clampRect(rect: Rect): Rect {
  const w = Math.min(Math.max(rect.w, MIN_SIDE), 1);
  const h = Math.min(Math.max(rect.h, MIN_SIDE), 1);
  return {
    w,
    h,
    x: Math.min(Math.max(rect.x, 0), 1 - w),
    y: Math.min(Math.max(rect.y, 0), 1 - h),
  };
}

/** Fractions as whole percentages, which is how the panel's number fields read. */
export function asPercent(value: number): number {
  return Math.round(value * 1000) / 10;
}
