import type { ReactNode } from "react";
import { NO_INDEX } from "@/lib/seo";
import { guardPanel } from "@/lib/auth/guard";
import { ADMIN_NAV, PanelShell } from "@/components/shell";

/**
 * The admin area contains everything the editor panel has, plus user
 * management, agreement versions, the audit log and system settings (§9.3).
 */
// Sign-in, panel and member pages stay out of search (D-252)
export const metadata = { robots: NO_INDEX };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("admin");

  return (
    <PanelShell user={user} area="yönetim" groups={ADMIN_NAV}>
      {children}
    </PanelShell>
  );
}