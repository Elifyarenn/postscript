"use client";

/**
 * The two menus of the magazine frame (D-112). Client components only because
 * they mark the page being shown; every page behind them still checks the
 * session on the server.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, Mail, MessagesSquare, Settings } from "lucide-react";
import { isNavActive, MEMBER_EXTRA_NAV, SITE_NAV, type MemberNavItem } from "@/lib/site";

const MEMBER_ICONS = {
  anon: Mail,
  messages: MessagesSquare,
  notifications: Bell,
  bookmarks: Bookmark,
  settings: Settings,
} as const;

export function SiteMainNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Ana menü">
      {SITE_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteMemberNav({ items }: { items: MemberNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="site-member-nav" aria-label="Üye menüsü">
      <ul>
        {items.map((item) => {
          const Icon = MEMBER_ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
              >
                <Icon aria-hidden className="member-icon" strokeWidth={1.5} />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="member-badge">{item.badge > 99 ? "99+" : item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="member-extra">
        {MEMBER_EXTRA_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            // "/social" is the feed itself; every other community page sits under it
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </p>
    </nav>
  );
}
