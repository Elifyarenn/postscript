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
import { BackButton } from "./back-button";
import { PanelModeSwitch } from "./panel-switch";
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
      { href: "/admin/categories", label: "Yazı alanları" },
      { href: "/admin/applications", label: "Yazar başvuruları" },
    ],
  },
  {
    label: "İçerik & Topluluk",
    items: [
      { href: "/admin/announcements", label: "Duyurular" },
      { href: "/admin/community", label: "Topluluk yönetimi" },
      { href: "/magazine", label: "Dergi" },
    ],
  },
  {
    label: "Editör işleri",
    items: [
      { href: "/editor/articles", label: "Makaleler & yayın kuyruğu" },
      { href: "/editor/issues", label: "Sayılar" },
      { href: "/editor/approvals", label: "Eser Onayı takibi" },
      { href: "/editor/media", label: "Medya kütüphanesi" },
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
];

/**
 * The editor panel is deliberately narrow (D-059): an editor reviews the
 * articles that fall into their own areas and manages the media library.
 * Issue planning, announcements, work approvals and writer applications are
 * the admin's business and do not appear here.
 */
export const EDITOR_NAV: NavGroup[] = [
  {
    label: "Genel",
    items: [
      { href: "/editor", label: "Genel bakış" },
      { href: "/account", label: "Hesabım" },
    ],
  },
  {
    label: "İnceleme",
    items: [
      { href: "/editor/articles", label: "Kategoriye düşen yazılar" },
      { href: "/editor/media", label: "Medya kütüphanesi" },
    ],
  },
];

export const READER_NAV: NavGroup[] = [
  {
    items: [
      { href: "/magazine", label: "Dergi" },
      { href: "/magazine/issues", label: "Sayılar" },
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
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-3 pl-14 lg:pl-6">
          <div className="flex items-center gap-3">
            <span className="hidden font-serif text-sm tracking-[0.2em] text-accent uppercase sm:block">
              {area}
            </span>
            <BackButton />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 text-sm">
            <PanelModeSwitch user={user} />
            <span className="font-medium">{user.displayName}</span>
            {/* A hybrid editor holds both duties and is titled "Editor & Yazar" (D-060) */}
            {user.role === "editor" && user.writerStatus !== null ? (
              <StatusBadge status="editor_writer" />
            ) : (
              <>
                <StatusBadge status={user.role} />
                {user.writerStatus && <StatusBadge status={user.writerStatus} />}
              </>
            )}
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