import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { ADMIN_NAV, EDITOR_NAV, PanelShell } from "@/components/shell";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

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