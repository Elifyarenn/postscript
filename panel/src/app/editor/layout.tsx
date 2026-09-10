import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { getAccessMode } from "@/services/access-mode";
import { restrictToAccountWhenClosed } from "@/lib/access-mode";
import { ADMIN_NAV, EDITOR_NAV, PanelShell } from "@/components/shell";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

  // While the site is closed only the admin works in the panels (D-049)
  const closed = (await getAccessMode()) === "closed";
  if (closed && restrictToAccountWhenClosed(user.role)) redirect("/account");

  // The editor routes are also the admin's editorial workspace (issues, the
  // work-approval tracker, the full article management). An admin who visits
  // them sees the admin sidebar, not the narrow editor one (D-059).
  const adminView = user.role === "admin";

  return (
    <PanelShell
      user={user}
      area={adminView ? "yönetim" : "editör paneli"}
      groups={adminView ? ADMIN_NAV : EDITOR_NAV}
    >
      {children}
    </PanelShell>
  );
}