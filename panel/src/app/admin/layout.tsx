import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { PanelShell } from "@/components/shell";

/**
 * The admin area contains everything the editor panel has, plus user
 * management, agreement versions, the audit log and system settings (§9.3).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("admin");

  return (
    <PanelShell
      user={user}
      area="yönetim"
      items={[
        { href: "/admin", label: "Genel bakış" },
        { href: "/admin/users", label: "Kullanıcılar" },
        { href: "/admin/agreements", label: "Sözleşme sürümleri" },
        { href: "/admin/settings", label: "Sistem" },
        { href: "/admin/audit", label: "Denetim kaydı" },
        { href: "/editor", label: "Editör paneli" },
        { href: "/magazine", label: "Dergi" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
