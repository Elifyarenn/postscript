/**
 * The sidebar of each area, defined once.
 *
 * The panels are for running the magazine and nothing else (D-165): no link
 * here leads to the magazine, the community or the account page. Those live in
 * the site frame, and the site's PANEL button is the one way back in.
 *
 * The admin sidebar is grouped into logical sections (general, management,
 * content, legal, quick links). The actual sidebar UI lives in `sidebar.tsx`
 * (a client component, so it can highlight the current page and manage the
 * mobile drawer); `PanelShell` here stays a server component.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./ui";
import { PanelSidebar } from "./sidebar";
import { House } from "lucide-react";
import { BackButton } from "./back-button";
import { PanelModeSwitch } from "./panel-switch";
import { readCsrfToken } from "@/lib/csrf";
import type { SessionUser } from "@/lib/auth/session";
import { KvkkNotice } from "./kvkk-notice";
import { USER_SEGMENTS, USER_SEGMENT_META } from "@/lib/user-segments";

export type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
  /** An unread count shown beside the label; hidden when zero. */
  badge?: number;
  /** Sub-links listed under this item; each is highlighted only on its own page. */
  children?: NavItem[];
};

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
    ],
  },
  {
    label: "Yönetim & Kullanıcılar",
    items: [
      {
        href: "/admin/users",
        label: "Kullanıcılar",
        // One sub-link per kind of account (D-087)
        children: USER_SEGMENTS.map((segment) => ({
          href: USER_SEGMENT_META[segment].href,
          label: USER_SEGMENT_META[segment].navLabel,
        })),
      },
      { href: "/admin/categories", label: "Yazı alanları" },
      { href: "/admin/applications", label: "Yazar başvuruları" },
    ],
  },
  {
    label: "İçerik & Topluluk",
    items: [
      { href: "/admin/announcements", label: "Duyurular" },
      {
        href: "/admin/community",
        label: "Topluluk yönetimi",
        // The community management panel's parts (D-180)
        children: [
          { href: "/admin/community/reports", label: "Bildirimler" },
          { href: "/admin/community/communities", label: "Topluluklar" },
          { href: "/admin/community/posts", label: "Gönderiler" },
          { href: "/admin/community/banned-words", label: "Yasaklı kelimeler" },
          { href: "/admin/community/comments", label: "Yorumlar ve sohbet" },
        ],
      },
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
        { href: "/writer/articles", label: "Yazılarım", disabled: locked },
        { href: "/writer/profile", label: "Profil ve güvenlik" },
      ],
    },
  ];
}

/**
 * The frame every panel page sits in: the responsive sidebar, a header naming
 * the signed-in user and their role, and the content column. The sidebar is
 * sticky on desktop and a hamburger drawer on mobile.
 */
export async function PanelShell({
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
  // The sign-out form is a mutation like any other, so it carries the same
  // double-submit token (D-072). Read here rather than at every call site.
  const csrfToken = (await readCsrfToken()) ?? "";

  return (
    <div className="min-h-screen lg:flex">
      <PanelSidebar user={user} area={area} groups={groups} csrfToken={csrfToken} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-3 pl-14 lg:pl-6">
          <div className="flex items-center gap-3">
            <span className="hidden font-serif text-sm tracking-[0.2em] text-accent uppercase sm:block">
              {area}
            </span>
            <BackButton />
            {/* The sidebar wordmark also leads home, but few people read a logo as a button */}
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-paper hover:text-ink"
              title="Derginin ana sayfasına git"
            >
              <House className="size-3.5" />
              Ana sayfa
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 text-sm">
            <PanelModeSwitch user={user} />
            {/* Only a name: the account page is the site's, not the panel's (D-165) */}
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

        <KvkkNotice user={user} csrfToken={csrfToken} />

        <main className="flex-1 px-6 py-8">
          <div className={cn("mx-auto", user.role === "admin" ? "max-w-6xl" : "max-w-5xl")}>
            {children}
          </div>
        </main>

        <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">
          {/* The statutory pages stay reachable from inside the panel too (D-084) */}
          <nav
            className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1"
            aria-label="Yasal sayfalar"
          >
            <Link href="/kunye" className="hover:text-ink">
              Künye
            </Link>
            <Link href="/kullanim-sartlari" className="hover:text-ink">
              Kullanım şartları
            </Link>
            <Link href="/kvkk" className="hover:text-ink">
              KVKK aydınlatma metni
            </Link>
          </nav>
          <span>
            Designed by{" "}
            <a
            href="https://www.elifyarencekic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
              Elif Yaren Çekiç
            </a>{" "}
            &amp; Tuanna Demir
          </span>
        </footer>
      </div>
    </div>
  );
}