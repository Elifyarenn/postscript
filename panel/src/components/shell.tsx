import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { StatusBadge } from "./ui";
import type { SessionUser } from "@/lib/auth/session";

export type NavItem = { href: string; label: string; disabled?: boolean };

/**
 * The sidebar of each area, defined once.
 *
 * `/account` is reachable from every role, so it has to render the navigation
 * the signed-in role expects rather than the reader's; sharing the lists here
 * is what keeps the two from drifting apart.
 */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Genel bakış" },
  { href: "/admin/users", label: "Kullanıcılar" },
  { href: "/admin/applications", label: "Yazar başvuruları" },
  { href: "/admin/writer-leads", label: "Yazar adayları" },
  { href: "/admin/categories", label: "Kategoriler" },
  { href: "/admin/announcements", label: "Duyurular" },
  { href: "/admin/agreements", label: "Sözleşme sürümleri" },
  { href: "/admin/settings", label: "Sistem" },
  { href: "/admin/community", label: "Topluluk yönetimi" },
  { href: "/admin/audit", label: "Denetim kaydı" },
  { href: "/editor", label: "Editör paneli" },
  { href: "/magazine", label: "Dergi" },
  { href: "/community", label: "Topluluk" },
  { href: "/account", label: "Hesabım" },
];

export const EDITOR_NAV: NavItem[] = [
  { href: "/editor", label: "Genel bakış" },
  { href: "/editor/articles", label: "Makaleler" },
  { href: "/editor/issues", label: "Sayılar" },
  { href: "/editor/media", label: "Medya kütüphanesi" },
  { href: "/editor/announcements", label: "Duyurular" },
  { href: "/editor/approvals", label: "Eser Onayı takibi" },
  { href: "/editor/applications", label: "Yazar başvuruları" },
  { href: "/magazine", label: "Dergi" },
  { href: "/community", label: "Topluluk" },
  { href: "/account", label: "Hesabım" },
];

export const READER_NAV: NavItem[] = [
  { href: "/magazine", label: "Dergi" },
  { href: "/magazine/issues", label: "Sayılar" },
  { href: "/community", label: "Topluluk" },
  { href: "/account", label: "Hesabım" },
];

/** `locked` only greys the links out; each page checks the rule itself. */
export function writerNav(locked: boolean): NavItem[] {
  return [
    { href: "/writer", label: "Genel bakış" },
    { href: "/writer/announcements", label: "Duyurular" },
    { href: "/writer/agreement", label: "Sözleşme" },
    { href: "/writer/approvals", label: "Eser Onayları", disabled: locked },
    { href: "/writer/articles", label: "Makalelerim", disabled: locked },
    { href: "/writer/profile", label: "Profil ve güvenlik" },
    { href: "/magazine", label: "Dergi" },
    { href: "/community", label: "Topluluk" },
  ];
}

/** The area a signed-in user belongs in, used by pages every role can open. */
export function navForRole(role: SessionUser["role"]): { area: string; items: NavItem[] } {
  if (role === "admin") return { area: "yönetim", items: ADMIN_NAV };
  if (role === "editor") return { area: "editör paneli", items: EDITOR_NAV };
  if (role === "writer") return { area: "yazar paneli", items: writerNav(false) };
  return { area: "dergi", items: READER_NAV };
}

/**
 * The frame every panel page sits in: a sidebar of links, a header naming the
 * signed-in user and their role, and the content column.
 *
 * Disabled links are a courtesy for the writer whose panel is partly locked;
 * the actual gate is the server-side check on each page.
 */
export function PanelShell({
  user,
  area,
  items,
  children,
}: {
  user: SessionUser;
  area: string;
  items: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-surface lg:min-h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between p-5 lg:block">
          <Link href="/" className="block">
            <span className="font-serif text-xl tracking-tight">postscript</span>
            <span className="mt-0.5 block text-[10px] tracking-[0.25em] text-muted uppercase">
              {area}
            </span>
          </Link>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-5">
          {items.map((item) =>
            item.disabled ? (
              <span
                key={item.href}
                className="cursor-not-allowed rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted/50"
                title="Bu sayfa şu anda kilitli"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm whitespace-nowrap text-ink hover:bg-paper"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="font-medium">{user.displayName}</span>
            <StatusBadge status={user.role} />
            {user.writerStatus && <StatusBadge status={user.writerStatus} />}
          </div>

          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Çıkış
            </button>
          </form>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
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
