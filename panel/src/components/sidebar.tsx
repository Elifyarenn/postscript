"use client";

/**
 * The responsive sidebar: sticky full-height burgundy aside on desktop,
 * hamburger drawer on mobile. The current page is highlighted in both, with a
 * small cream accent bar beside the active link.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowRight, LayoutDashboard, Megaphone, Menu, Scale, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import type { NavGroup } from "./shell";
import type { SessionUser } from "@/lib/auth/session";

const GROUP_ICONS: Record<string, ReactNode> = {
  Genel: <LayoutDashboard className="size-3.5" />,
  "Yönetim & Kullanıcılar": <Users className="size-3.5" />,
  "İçerik & Topluluk": <Megaphone className="size-3.5" />,
  "Yasal & Sistem": <Scale className="size-3.5" />,
  "Hızlı Geçiş": <ArrowRight className="size-3.5" />,
};

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: { href: string; label: string; disabled?: boolean };
  pathname: string;
  onNavigate?: () => void;
}) {
  if (item.disabled) {
    return (
      <span
        className="cursor-not-allowed rounded-md px-3 py-2 text-sm whitespace-nowrap text-paper/40"
        title="Bu sayfa şu anda kilitli"
      >
        {item.label}
      </span>
    );
  }

  // A section root ("/admin") matches only itself; deeper pages match their
  // own branch so /admin/users/… highlights "Kullanıcılar"
  const isRoot = item.href.split("/").length === 2;
  const active = pathname === item.href || (!isRoot && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-white/12 font-medium text-white"
          : "text-paper/85 hover:bg-white/10 hover:text-white",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-paper"
        />
      )}
      {item.label}
    </Link>
  );
}

function NavContent({
  groups,
  pathname,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-5">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? groupIndex}>
          {group.label && (
            <div className="flex items-center gap-1.5 px-3 pt-4 pb-1.5">
              {group.icon ?? GROUP_ICONS[group.label]}
              <span className="text-[10px] font-semibold tracking-[0.18em] text-paper/60 uppercase">
                {group.label}
              </span>
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarFrame({
  area,
  groups,
  pathname,
  csrfToken,
  onNavigate,
}: {
  area: string;
  groups: NavGroup[];
  pathname: string;
  csrfToken: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link href="/" className="block px-5 pt-5 pb-4">
        <span className="font-serif text-xl tracking-tight text-paper">postscript</span>
        <span className="mt-0.5 block text-[10px] tracking-[0.25em] text-paper/60 uppercase">
          {area}
        </span>
      </Link>

      <NavContent groups={groups} pathname={pathname} onNavigate={onNavigate} />

      <div className="border-t border-white/15 p-4">
        <form action={logoutAction}>
          {/* Signing out is a mutation, so it carries the token too (D-072) */}
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <button
            type="submit"
            className="w-full rounded-md border border-white/20 px-3 py-1.5 text-sm text-paper/80 hover:bg-white/10 hover:text-white"
          >
            Çıkış
          </button>
        </form>
      </div>
    </>
  );
}

export function PanelSidebar({
  user,
  area,
  groups,
  csrfToken,
}: {
  user: SessionUser;
  area: string;
  groups: NavGroup[];
  csrfToken: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: sticky burgundy aside, content scrolls beside it */}
      <aside className="hidden w-64 shrink-0 flex-col bg-accent lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <SidebarFrame area={area} groups={groups} pathname={pathname} csrfToken={csrfToken} />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        type="button"
        aria-label="Menüyü aç"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-md bg-accent p-2 text-paper shadow lg:hidden"
      >
        <Menu className="size-4" />
      </button>

      {/* Mobile: drawer with backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-accent shadow-xl">
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-md border border-white/20 p-1.5 text-paper"
            >
              <X className="size-4" />
            </button>
            <SidebarFrame
              area={area}
              groups={groups}
              pathname={pathname}
              csrfToken={csrfToken}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}