import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { ADMIN_NAV, PanelShell } from "@/components/shell";

/**
 * The admin area contains everything the editor panel has, plus user
 * management, agreement versions, the audit log and system settings (§9.3).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("admin");

  return (
    <PanelShell user={user} area="yönetim" items={ADMIN_NAV}>
      {children}
    </PanelShell>
  );
}
