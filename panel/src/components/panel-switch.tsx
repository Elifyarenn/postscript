"use client";

/**
 * The hybrid role toggle (D-060): an editor who also holds a writer duty can
 * switch between the "Yazar Paneli" and "Editör Paneli" in one tap. The two
 * panels are separate route trees, so the switch is a pair of links; the side
 * the visitor is on is highlighted. An admin gets the same pair, writer panel
 * and admin panel (D-304). Renders nothing for anyone else.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

export function PanelModeSwitch({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  // An admin writes too, from the same writer panel (D-304)
  const isAdmin = user.role === "admin";
  if (!isAdmin && !(user.role === "editor" && user.writerStatus !== null)) return null;

  // Each button is highlighted only while its own panel is open. On a page
  // that is neither panel (e.g. /account) neither button is active.
  const inWriter = pathname.startsWith("/writer");
  const inEditor = isAdmin
    ? pathname.startsWith("/admin") || pathname.startsWith("/editor")
    : pathname.startsWith("/editor");

  const buttonClass = (active: boolean) =>
    cn(
      "inline-flex min-h-10 items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0",
      active ? "bg-accent text-white" : "bg-paper text-muted hover:text-ink",
    );

  return (
    <div
      role="group"
      aria-label="Panel seçimi"
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper p-1"
    >
      <Link href="/writer" className={buttonClass(inWriter)}>
        Yazar Paneli
      </Link>
      <Link href={isAdmin ? "/admin" : "/editor"} className={buttonClass(inEditor)}>
        {isAdmin ? "Yönetim Paneli" : "Editör Paneli"}
      </Link>
    </div>
  );
}