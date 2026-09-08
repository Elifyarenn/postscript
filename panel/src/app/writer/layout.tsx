import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { pendingAcknowledgements } from "@/services/announcements";
import { getAccessMode } from "@/services/access-mode";
import { restrictToAccountWhenClosed } from "@/lib/access-mode";
import { hasRole } from "@/lib/auth/rbac";
import { PanelShell, writerNav } from "@/components/shell";

/**
 * Writer panel shell.
 *
 * Two things can lock the inner pages: a writer_status other than `active`
 * (§3 rule 5) and an unacknowledged mandatory announcement (§9.1). The
 * announcements and agreement pages stay open in both cases, otherwise there
 * would be no way out of the lock. Greying the links out is only a courtesy —
 * each page checks for itself.
 *
 * While the site is closed, writers see only the account area; the one
 * exception is a writer who still has to sign the contract, because that page
 * is the way out of the lock (D-049).
 */
export default async function WriterLayout({ children }: { children: ReactNode }) {
  const context = await guardPanel("writer");
  const { user } = context;

  const closed = (await getAccessMode()) === "closed";
  if (closed && restrictToAccountWhenClosed(user.role) && user.writerStatus !== "pending_agreement") {
    redirect("/account");
  }

  const pending = await pendingAcknowledgements({ ...user });

  const lockedByStatus = !hasRole(user.role, "editor") && user.writerStatus !== "active";
  const locked = lockedByStatus || pending.length > 0;

  return (
    <PanelShell user={user} area="yazar paneli" groups={writerNav(locked)}>
      {children}
    </PanelShell>
  );
}