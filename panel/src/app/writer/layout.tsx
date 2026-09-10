import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { pendingAcknowledgements } from "@/services/announcements";
import { hasRole } from "@/lib/auth/rbac";
import { PanelShell, writerNav } from "@/components/shell";

/**
 * Writer panel shell.
 *
 * An unacknowledged mandatory announcement locks the inner pages (§9.1); the
 * announcements and agreement pages stay open in both cases, otherwise there
 * would be no way out of the lock. A frozen writer is also locked. Greying the
 * links out is only a courtesy — each page checks for itself.
 *
 * The contract no longer locks the panel: writers are active from the moment
 * they are approved (D-050).
 */
export default async function WriterLayout({ children }: { children: ReactNode }) {
  const context = await guardPanel("writer");
  const { user } = context;

  const pending = await pendingAcknowledgements({ ...user });

  const lockedByStatus = !hasRole(user.role, "editor") && user.writerStatus === "suspended";
  const locked = lockedByStatus || pending.length > 0;

  return (
    <PanelShell user={user} area="yazar paneli" groups={writerNav(locked)}>
      {children}
    </PanelShell>
  );
}