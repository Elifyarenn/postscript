import type { ReactNode } from "react";
import { requireSession } from "@/lib/auth/guard";
import { PanelShell, socialNav } from "@/components/shell";
import { unreadNotificationCount } from "@/services/notifications";
import { getMemberSettings } from "@/services/social";

/**
 * The community area (D-089). Like the magazine it asks for a session and no
 * role; every service below still checks the actor itself.
 */
export default async function SocialLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();
  const [settings, unread] = await Promise.all([
    getMemberSettings({ ...user }),
    unreadNotificationCount({ ...user }),
  ]);

  return (
    <PanelShell
      user={user}
      area="topluluk"
      groups={socialNav({ username: settings.username, notifications: unread })}
    >
      {children}
    </PanelShell>
  );
}
