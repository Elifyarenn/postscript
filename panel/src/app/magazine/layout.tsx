import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guard";
import { getAccessMode } from "@/services/access-mode";
import { restrictToAccountWhenClosed } from "@/lib/access-mode";
import { PanelShell, READER_NAV } from "@/components/shell";

/**
 * The reading area, and the only area a plain reader has.
 *
 * It asks for a session but for no role: a writer, editor or admin reads the
 * magazine the same way a reader does. Everything shown here is already public
 * material, so there is nothing further to guard. While the site is closed the
 * reading area waits; only the admin can leave the account area (D-049).
 */
export default async function MagazineLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession();

  const closed = (await getAccessMode()) === "closed";
  if (closed && restrictToAccountWhenClosed(user.role)) redirect("/account");

  return (
    <PanelShell user={user} area="dergi" groups={READER_NAV}>
      {children}
    </PanelShell>
  );
}
