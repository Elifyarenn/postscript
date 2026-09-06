import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { pendingAcknowledgements } from "@/services/announcements";
import { hasRole } from "@/lib/auth/rbac";
import { PanelShell } from "@/components/shell";

/**
 * Writer panel shell.
 *
 * Two things can lock the inner pages: a writer_status other than `active`
 * (§3 rule 5) and an unacknowledged mandatory announcement (§9.1). The
 * announcements and agreement pages stay open in both cases, otherwise there
 * would be no way out of the lock. Greying the links out is only a courtesy —
 * each page checks for itself.
 */
export default async function WriterLayout({ children }: { children: ReactNode }) {
  const context = await guardPanel("writer");
  const { user } = context;

  const pending = await pendingAcknowledgements({ ...user });

  const lockedByStatus = !hasRole(user.role, "editor") && user.writerStatus !== "active";
  const locked = lockedByStatus || pending.length > 0;

  return (
    <PanelShell
      user={user}
      area="yazar paneli"
      items={[
        { href: "/writer", label: "Genel bakış" },
        { href: "/writer/announcements", label: "Duyurular" },
        { href: "/writer/agreement", label: "Sözleşme" },
        { href: "/writer/approvals", label: "Eser Onayları", disabled: locked },
        { href: "/writer/articles", label: "Makalelerim", disabled: locked },
        { href: "/writer/profile", label: "Profil ve güvenlik" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
