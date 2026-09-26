import { NO_INDEX } from "@/lib/seo";
import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth/guard";
import { SiteShell } from "@/components/site-shell";

/**
 * The community area (D-089). Like the magazine it asks for a session and no
 * role; every service below still checks the actor itself. The member menu and
 * its unread counts come with the magazine frame (D-112).
 */
// Sign-in, panel and member pages stay out of search (D-252)
export const metadata = { robots: NO_INDEX };

export default async function SocialLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return <SiteShell user={user}>{children}</SiteShell>;
}
