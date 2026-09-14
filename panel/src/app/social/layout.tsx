import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth/guard";
import { SiteShell } from "@/components/site-shell";

/**
 * The community area (D-089). Like the magazine it asks for a session and no
 * role; every service below still checks the actor itself. The member menu and
 * its unread counts come with the magazine frame (D-112).
 */
export default async function SocialLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  return <SiteShell user={user}>{children}</SiteShell>;
}
