import type { ReactNode } from "react";
import { SiteShell } from "@/components/site-shell";

/**
 * The reading area as a visitor without a session sees it (D-351): the same
 * frame as `/magazine`, with no account menu, so nothing here reads a cookie
 * and every page under it can be served from the CDN.
 */
export default function AnonymousMagazineLayout({ children }: { children: ReactNode }) {
  return <SiteShell user={null}>{children}</SiteShell>;
}
