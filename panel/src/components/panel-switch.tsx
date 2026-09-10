"use client";

/**
 * The hybrid role toggle (D-060): an editor who also holds a writer duty can
 * switch between the "Yazar Paneli" and "Editör Paneli" in one tap. The two
 * panels are separate route trees, so the switch is a pair of links; the side
 * the visitor is on is highlighted. Renders nothing for non-hybrid users.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/session";

export function PanelModeSwitch({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  if (!(user.role === "editor" && user.writerStatus !== null)) return null;

  const inEditor = pathname.startsWith("/editor");

  const buttonClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-accent text-white" : "bg-paper text-muted hover:text-ink",
    );

  return (
    <div
      role="group"
      aria-label="Panel seçimi"
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper p-1"
    >
      <Link href="/writer" className={buttonClass(!inEditor)}>
        Yazar Paneli
      </Link>
      <Link href="/editor" className={buttonClass(inEditor)}>
        Editör Paneli
      </Link>
    </div>
  );
}