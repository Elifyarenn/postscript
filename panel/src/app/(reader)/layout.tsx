import type { ReactNode } from "react";

/**
 * The reading frame (D-236).
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
  return <div className="ps-site reader-frame">{children}</div>;
}
