"use client";

/**
 * One designed page, with its clickable areas on top (D-240).
 *
 * The picture is the page. Everything above it is positioned in fractions of
 * the picture element itself — not of the frame around it — so an area sits on
 * the same part of the design at any size, at any zoom and on any screen. The
 * padding around the page is not part of the page.
 *
 * Nothing about an area is drawn for a reader unless the editor asked for a
 * hint. Keyboard focus is always visible: an invisible control that cannot be
 * found by tabbing is not a control.
 */
import { useId, useState } from "react";
import { ExternalLink, HelpCircle, Info, MoveRight } from "lucide-react";
import type { ReaderHotspot } from "@/lib/issue-hotspots";
import type { ReaderPage } from "@/lib/issue-reader";

const MARKER_ICON = {
  link: ExternalLink,
  page: MoveRight,
  info: Info,
  quiz: HelpCircle,
} as const;

function labelFor(area: ReaderHotspot): string {
  if (area.ariaLabel?.trim()) return area.ariaLabel;
  if (area.name?.trim()) return area.name;
  switch (area.kind) {
    case "link":
      return "Bağlantıyı aç";
    case "page":
      return "Sayfaya git";
    case "info":
      return area.infoTitle ?? "Bilgi kutusunu aç";
    case "quiz":
      return "Testi aç";
    default:
      return "Etkileşim";
  }
}

export function IssuePageImage({
  page,
  onHotspot,
  /** Editing draws every area; reading draws only the ones asked to show. */
  showAllAreas = false,
  suppressClicks,
}: {
  page: ReaderPage;
  onHotspot: (area: ReaderHotspot) => void;
  showAllAreas?: boolean;
  /** True right after a drag, so panning never opens what it passed over. */
  suppressClicks?: () => boolean;
}) {
  const describedBy = useId();
  // Keyed by address, so turning to another page starts fresh
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = page.imageUrl !== null && failedUrl === page.imageUrl;
  const known = Boolean(page.imageWidth && page.imageHeight);
  // The ratio sizes the page before its picture arrives, so nothing jumps
  const style = known
    ? ({
        aspectRatio: `${page.imageWidth} / ${page.imageHeight}`,
        "--page-ratio": page.imageHeight! / page.imageWidth!,
      } as React.CSSProperties)
    : undefined;

  return (
    <figure className="page-image" style={style}>
      {/* A picture that does not arrive leaves a sentence, not a broken icon (D-257) */}
      {failed && (
        <p className="page-image-missing" role="status">
          Bu sayfanın görseli şu anda yüklenemedi.
        </p>
      )}
      {page.imageUrl && !failed && (
        <img
          src={page.imageUrl}
          alt={page.imageAlt ?? `Sayfa ${page.position}`}
          width={page.imageWidth ?? undefined}
          height={page.imageHeight ?? undefined}
          decoding="async"
          draggable={false}
          aria-describedby={page.transcript ? describedBy : undefined}
          onError={() => setFailedUrl(page.imageUrl)}
        />
      )}

      {page.hotspots.map((area) => {
        const Icon = MARKER_ICON[area.kind];
        const style = {
          left: `${area.x * 100}%`,
          top: `${area.y * 100}%`,
          width: `${area.w * 100}%`,
          height: `${area.h * 100}%`,
        };
        const marked = area.showMarker || showAllAreas;

        // A link is an anchor so it behaves like one: middle click, copy
        // address, open in a new tab — all the things a reader expects
        if (area.kind === "link" && area.url) {
          return (
            <a
              key={area.id}
              className="page-hotspot"
              data-kind={area.kind}
              data-marked={marked ? "" : undefined}
              style={style}
              href={area.url}
              target={area.openInNewTab ? "_blank" : undefined}
              rel={area.openInNewTab ? "noopener noreferrer" : undefined}
              aria-label={labelFor(area)}
              onClick={(event) => {
                if (suppressClicks?.()) event.preventDefault();
              }}
            >
              {marked && <Icon aria-hidden />}
            </a>
          );
        }

        return (
          <button
            key={area.id}
            type="button"
            className="page-hotspot"
            data-kind={area.kind}
            data-marked={marked ? "" : undefined}
            style={style}
            aria-label={labelFor(area)}
            onClick={() => {
              if (suppressClicks?.()) return;
              onHotspot(area);
            }}
          >
            {marked && <Icon aria-hidden />}
          </button>
        );
      })}

      {/* Read out by a screen reader, off screen for everyone else: the words
          on a designed page are pixels and cannot be read any other way */}
      {page.transcript && (
        <figcaption id={describedBy} className="page-transcript">
          {page.transcript}
        </figcaption>
      )}
    </figure>
  );
}
