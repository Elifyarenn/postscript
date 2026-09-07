"use client";

/**
 * The responsive sidebar: sticky full-height aside on desktop, hamburger
 * drawer on mobile. The current page is highlighted in both, with a small
 * accent bar beside the active link.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowRight, LayoutDashboard, Megaphone, Menu, Scale, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(auth)/actions";
import { StatusBadge } from "./ui";
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
        className="cursor-not-allowed rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted/50"
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
        active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-paper",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
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
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? groupIndex}>
          {group.label && (
            <div className="flex items-center gap-1.5 px-3 pt-4 pb-1.5">
              {group.icon ?? GROUP_ICONS[group.label]}
              <span className="text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
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
  user,
  area,
  groups,
  pathname,
  onNavigate,
}: {
  user: SessionUser;
  area: string;
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link href="/" className="block px-5 pt-5 pb-4">
        <span className="font-serif text-xl tracking-tight">postscript</span>
        <span className="mt-0.5 block text-[10px] tracking-[0.25em] text-muted uppercase">
          {area}
        </span>
      </Link>

      <NavContent groups={groups} pathname={pathname} onNavigate={onNavigate} />

      <div className="border-t border-line p-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="font-medium">{user.displayName}</span>
          <StatusBadge status={user.role} />
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:bg-paper hover:text-ink"
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
}: {
  user: SessionUser;
  area: string;
  groups: NavGroup[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: sticky aside, content scrolls beside it */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen">
        <SidebarFrame user={user} area={area} groups={groups} pathname={pathname} />
      </aside>

      {/* Mobile: hamburger button */}
      <button
        type="button"
        aria-label="Menüyü aç"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 rounded-md border border-line bg-surface p-2 lg:hidden"
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
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 rounded-md border border-line p-1.5"
            >
              <X className="size-4" />
            </button>
            <SidebarFrame
              user={user}
              area={area}
              groups={groups}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}