/**
 * The sidebar of each area, defined once.
 *
 * `/account` is reachable from every role, so it has to render the navigation
 * the signed-in role expects rather than the reader's; sharing the lists here
 * is what keeps the two from drifting apart.
 *
 * The admin sidebar is grouped into logical sections (general, management,
 * content, legal, quick links). The actual sidebar UI lives in `sidebar.tsx`
 * (a client component, so it can highlight the current page and manage the
 * mobile drawer); `PanelShell` here stays a server component.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./ui";
import { PanelSidebar } from "./sidebar";
import type { SessionUser } from "@/lib/auth/session";

export type NavItem = { href: string; label: string; disabled?: boolean };

export type NavGroup = {
  /** Uppercase, gray section heading; omitted for single-section menus. */
  label?: string;
  icon?: ReactNode;
  items: NavItem[];
};

/** The admin sidebar, grouped by responsibility (module: sidebar rework). */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Genel",
    items: [
      { href: "/admin", label: "Genel bakış" },
      { href: "/account", label: "Hesabım" },
    ],
  },
  {
    label: "Yönetim & Kullanıcılar",
    items: [
      { href: "/admin/users", label: "Kullanıcılar" },
      { href: "/admin/applications", label: "Yazar başvuruları" },
      { href: "/admin/writer-leads", label: "Yazar adayları" },
      { href: "/admin/categories", label: "Kategoriler" },
    ],
  },
  {
    label: "İçerik & Topluluk",
    items: [
      { href: "/admin/announcements", label: "Duyurular" },
      { href: "/admin/community", label: "Topluluk yönetimi" },
      { href: "/community", label: "Topluluk sohbeti" },
      { href: "/magazine", label: "Dergi" },
    ],
  },
  {
    label: "Yasal & Sistem",
    items: [
      { href: "/admin/agreements", label: "Sözleşme sürümleri" },
      { href: "/admin/audit", label: "Denetim kaydı" },
      { href: "/admin/settings", label: "Sistem" },
    ],
  },
  {
    label: "Hızlı Geçiş",
    items: [{ href: "/editor", label: "Editör paneli" }],
  },
];

export const EDITOR_NAV: NavGroup[] = [
  {
    label: "Genel",
    items: [
      { href: "/editor", label: "Genel bakış" },
      { href: "/account", label: "Hesabım" },
    ],
  },
  {
    label: "İçerik",
    items: [
      { href: "/editor/articles", label: "Makaleler" },
      { href: "/editor/issues", label: "Sayılar" },
      { href: "/editor/media", label: "Medya kütüphanesi" },
      { href: "/editor/announcements", label: "Duyurular" },
      { href: "/editor/approvals", label: "Eser Onayı takibi" },
      { href: "/editor/applications", label: "Yazar başvuruları" },
    ],
  },
  {
    label: "Dergi & Topluluk",
    items: [
      { href: "/magazine", label: "Dergi" },
      { href: "/community", label: "Topluluk" },
    ],
  },
];

export const READER_NAV: NavGroup[] = [
  {
    items: [
      { href: "/magazine", label: "Dergi" },
      { href: "/magazine/issues", label: "Sayılar" },
      { href: "/community", label: "Topluluk" },
      { href: "/account", label: "Hesabım" },
    ],
  },
];

/** `locked` only greys the links out; each page checks the rule itself. */
export function writerNav(locked: boolean): NavGroup[] {
  return [
    {
      label: "Yazar",
      items: [
        { href: "/writer", label: "Genel bakış" },
        { href: "/writer/announcements", label: "Duyurular" },
        { href: "/writer/agreement", label: "Sözleşme" },
        { href: "/writer/approvals", label: "Eser Onayları", disabled: locked },
        { href: "/writer/articles", label: "Makalelerim", disabled: locked },
        { href: "/writer/profile", label: "Profil ve güvenlik" },
        { href: "/magazine", label: "Dergi" },
        { href: "/community", label: "Topluluk" },
      ],
    },
  ];
}

/** The area a signed-in user belongs in, used by pages every role can open. */
export function navForRole(role: SessionUser["role"]): { area: string; groups: NavGroup[] } {
  if (role === "admin") return { area: "yönetim", groups: ADMIN_NAV };
  if (role === "editor") return { area: "editör paneli", groups: EDITOR_NAV };
  if (role === "writer") return { area: "yazar paneli", groups: writerNav(false) };
  return { area: "dergi", groups: READER_NAV };
}

/**
 * The frame every panel page sits in: the responsive sidebar, a header naming
 * the signed-in user and their role, and the content column. The sidebar is
 * sticky on desktop and a hamburger drawer on mobile.
 */
export function PanelShell({
  user,
  area,
  groups,
  children,
}: {
  user: SessionUser;
  area: string;
  groups: NavGroup[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <PanelSidebar user={user} area={area} groups={groups} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3 pl-14 lg:pl-6">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="font-medium">{user.displayName}</span>
            <StatusBadge status={user.role} />
            {user.writerStatus && <StatusBadge status={user.writerStatus} />}
          </div>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className={cn("mx-auto", user.role === "admin" ? "max-w-6xl" : "max-w-5xl")}>
            {children}
          </div>
        </main>

        <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">
          <a
            href="https://www.elifyarencekic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            Designed by Elif Yaren Çekiç & Tuanna Demir
          </a>
        </footer>
      </div>
    </div>
  );
}