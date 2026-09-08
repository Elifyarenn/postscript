import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { guardPanel } from "@/lib/auth/guard";
import { getAccessMode } from "@/services/access-mode";
import { restrictToAccountWhenClosed } from "@/lib/access-mode";
import { EDITOR_NAV, PanelShell } from "@/components/shell";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardPanel("editor");

  // While the site is closed only the admin works in the panels (D-049)
  const closed = (await getAccessMode()) === "closed";
  if (closed && restrictToAccountWhenClosed(user.role)) redirect("/account");

  return (
    <PanelShell user={user} area="editör paneli" groups={EDITOR_NAV}>
      {children}
    </PanelShell>
  );
}