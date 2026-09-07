import type { ReactNode } from "react";
import { guardPanel } from "@/lib/auth/guard";
import { EDITOR_NAV, PanelShell } from "@/components/shell";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

  return (
    <PanelShell user={user} area="editör paneli" groups={EDITOR_NAV}>
      {children}
    </PanelShell>
  );
}