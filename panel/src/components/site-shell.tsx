/**
 * The magazine's own frame (D-112), drawn from the postscriptui designs: the
 * dark top strip, the wordmark header with the main menu and search, the member
 * menu beside the paper column and the wine footer.
 *
 * The front page, the about page, the reading area and the community sit in
 * it. The admin, editor and writer panels keep `PanelShell`: those are working
 * tools, not the magazine.
 */
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Music, Search, Settings, UserRound } from "lucide-react";
import footerFlowers from "@/assets/design/footer-flowers.webp";
import { logoutAction } from "@/app/(auth)/actions";
import { panelPathFor } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import { readCsrfToken } from "@/lib/csrf";
import { bodyFont, capsFont, italicFont } from "@/lib/fonts";
import { memberNav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { unreadAnonCount } from "@/services/anon-box";
import { unreadConversationCount } from "@/services/direct-messages";
import { unreadNotificationCount } from "@/services/notifications";
import { getMemberSettings } from "@/services/social";
import { KvkkNotice } from "./kvkk-notice";
import { SiteMainNav, SiteMemberNav } from "./site-nav";
import { Stars, Wordmark } from "./site-ui";
import "@/app/site.css";

const MAGAZINE_LINKS = [
  { href: "/magazine/issues", label: "sayılar" },
  { href: "/magazine", label: "son yazılar" },
  { href: "/social", label: "topluluk" },
  { href: "/hakkinda", label: "hakkında" },
] as const;

// 5651 s. 3 wants these reachable from the front page (D-084)
const LEGAL_LINKS = [
  { href: "/kullanim-sartlari", label: "kullanım şartları" },
  { href: "/kvkk", label: "gizlilik ve KVKK" },
  { href: "/iletisim", label: "künye ve iletişim" },
] as const;

async function memberState(user: SessionUser) {
  const actor = { ...user };
  const [settings, notifications, messages, anon] = await Promise.all([
    getMemberSettings(actor),
    unreadNotificationCount(actor),
    unreadConversationCount(actor),
    unreadAnonCount(actor),
  ]);
  return { username: settings.username, notifications, messages, anon };
}

export async function SiteShell({
  user,
  bleed = false,
  children,
}: {
  /** Null on a public page read without a session. */
  user: SessionUser | null;
  /** Lets a page run edge to edge, as the front page's picture does. */
  bleed?: boolean;
  children: ReactNode;
}) {
  // Banned accounts get no member menu: the community pages would refuse them
  const member = user && !user.isBanned ? await memberState(user) : null;
  const csrfToken = user ? ((await readCsrfToken()) ?? "") : "";
  // Only a link: the panel layouts still decide who gets in (D-086)
  const panelHref = user ? panelPathFor(user) : null;

  return (
    <div className={cn("ps-site", bodyFont.variable, capsFont.variable, italicFont.variable)}>
      <div className="site-topbar">
        <div className="site-topbar-inner">
          <Link href="/magazine/issues" className="topbar-cell">
            Yeni sayı! <Stars />
          </Link>

          <span className="topbar-welcome">
            Hoş geldin <Music aria-hidden className="size-4" />
          </span>

          <div className="topbar-actions">
            {user ? (
              <>
                <Link href="/social/settings" className="topbar-cell">
                  <Settings aria-hidden />
                  Ayarlar
                </Link>
                {member?.username && (
                  <Link href={`/social/u/${member.username}`} className="topbar-cell">
                    <UserRound aria-hidden />
                    Blog
                  </Link>
                )}
                <Link href="/account" className="topbar-cell">
                  PROFİL
                </Link>
                {panelHref && (
                  <Link href={panelHref} className="topbar-cell topbar-strong">
                    PANEL
                  </Link>
                )}
                <form action={logoutAction}>
                  {/* Signing out is a mutation, so it carries the token too (D-072) */}
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <button type="submit" className="topbar-cell">
                    Çıkış
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="topbar-cell">
                  Giriş yap
                </Link>
                <Link href="/register" className="topbar-cell topbar-strong">
                  Hemen katıl
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="site-frame">
        {member && (
          <SiteMemberNav
            items={memberNav({
              anon: member.anon,
              messages: member.messages,
              notifications: member.notifications,
            })}
          />
        )}

        <div className="site-column">
          <header className="site-header">
            <Link href="/" className="site-brand" aria-label="PostScript Dergi ana sayfa">
              <Wordmark />
              <span className="site-tagline">The things left unsaid</span>
            </Link>

            <div className="site-header-tools">
              <SiteMainNav />
              {/* A plain GET form: searching changes nothing, so it needs no token */}
              <form action="/magazine" method="get" role="search" className="site-search">
                <label htmlFor="site-search" className="sr-only">
                  Dergide ara
                </label>
                <input id="site-search" name="q" type="search" maxLength={100} />
                <button type="submit" aria-label="Ara">
                  <Search aria-hidden />
                </button>
              </form>
            </div>
          </header>

          {user && <KvkkNotice user={user} csrfToken={csrfToken} />}

          <main className={cn("site-main", !bleed && "site-main-padded")}>{children}</main>
        </div>
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-brand">
            <Wordmark />
            <p>
              © {new Date().getFullYear()}
              <br />
              tüm hakları saklıdır
            </p>
          </div>

          <Stars className="footer-stars" />

          <nav className="footer-links" aria-label="Alt bağlantılar">
            <ul>
              {MAGAZINE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
            <ul>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <Image src={footerFlowers} alt="" className="footer-flowers" />
        </div>

        <p className="site-credit">
          <a href="https://www.elifyarencekic.com/" target="_blank" rel="noopener noreferrer">
            Designed by Elif Yaren Çekiç &amp; Tuanna Demir
          </a>
        </p>
      </footer>
    </div>
  );
}
