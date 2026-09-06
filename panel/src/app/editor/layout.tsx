import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { PanelShell } from "@/components/shell";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

  return (
    <PanelShell
      user={user}
      area="editör paneli"
      items={[
        { href: "/editor", label: "Genel bakış" },
        { href: "/editor/articles", label: "Makaleler" },
        { href: "/editor/issues", label: "Sayılar" },
        { href: "/editor/media", label: "Medya kütüphanesi" },
        { href: "/editor/announcements", label: "Duyurular" },
        { href: "/editor/approvals", label: "Eser Onayı takibi" },
        { href: "/magazine", label: "Dergi" },
      ]}
    >
      {children}
    </PanelShell>
  );
}
