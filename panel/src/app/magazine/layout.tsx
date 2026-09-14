import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth/guard";
import { SiteShell } from "@/components/site-shell";

/**
 * The reading area, and the only area a plain reader has.
 *
 * It asks for a session but for no role: a writer, editor or admin reads the
 * magazine the same way a reader does. Everything shown here is already public
 * material, so there is nothing further to guard. It sits in the magazine's
 * own frame rather than the panel's (D-112).
 */
export default async function MagazineLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return <SiteShell user={user}>{children}</SiteShell>;
}
