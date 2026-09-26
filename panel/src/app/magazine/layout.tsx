import type { ReactNode } from "react";
import { getAuthContext } from "@/lib/auth/session";
import { SiteShell } from "@/components/site-shell";

/**
 * The reading area, open to everyone (D-257).
 *
 * Published issues and articles are read without an account; a session only
 * adds the member features, which each page asks for itself. It sits in the
 * magazine's own frame rather than the panel's (D-112). The header shows the
 * account menu when there is a session, as on the front page.
 */
export default async function MagazineLayout({ children }: { children: ReactNode }) {
  const context = await getAuthContext();

  return <SiteShell user={context?.user ?? null}>{children}</SiteShell>;
}
