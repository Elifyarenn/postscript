import type { ReactNode } from "react";
import { NO_INDEX } from "@/lib/seo";
import { guardIllustratorPanel } from "@/lib/auth/guard";
import { PanelShell, illustratorNav } from "@/components/shell";

/**
 * The illustrator panel (D-288): a çizer who is not a writer has no writer
 * panel, yet signs the same contributor contract. This frame holds only that.
 */
export const metadata = { robots: NO_INDEX };

export default async function IllustratorLayout({ children }: { children: ReactNode }) {
  const { user } = await guardIllustratorPanel();
  return (
    <PanelShell user={user} area="çizer paneli" groups={illustratorNav()}>
      {children}
    </PanelShell>
  );
}
