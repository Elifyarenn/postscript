import type { ReactNode } from "react";
import { bodyFont, capsFont, italicFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
// The reader's styles live with the magazine's. Only `SiteShell` imported them,
// and this layout does not render it, so a reader opened directly (not reached
// by a click from the site) came up unstyled: toolbar icons run together,
// pictures at full size with wide gaps, and the quiz drawn inline instead of
// as a window (D-247)
import "@/app/site.css";

/**
 * The reading frame (D-240).
 *
 * Deliberately bare: no site header, no account menu, no footer. An issue is
 * meant to fill the screen, and the site's own furniture around it both steals
 * the room and breaks the spell. The route group keeps the magazine's address
 * unchanged while leaving the magazine's layout behind.
 *
 * The session is required by the page itself, which also decides whether this
 * particular issue may be opened at all.
 */
export default function ReaderLayout({ children }: { children: ReactNode }) {
  return (
    <div className={cn("ps-site reader-frame", bodyFont.variable, capsFont.variable, italicFont.variable)}>
      {children}
    </div>
  );
}
