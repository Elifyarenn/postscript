"use client";

/**
 * The two menus of the magazine frame (D-112). Client components only because
 * they mark the page being shown; every page behind them still checks the
 * session on the server.
 */
import type { SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bookmark, Mail } from "lucide-react";
import { isNavActive, SITE_NAV, type MemberNavItem } from "@/lib/site";

/*
 * Two of the design's menu icons have no match in the icon set (D-181): the
 * messages entry draws two round speech bubbles, not square ones, and the
 * settings entry a solid cog with a hole rather than an outline.
 */
function MessagesIcon({ strokeWidth = 1.5, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.5 2.75c-4 0-7 2.65-7 6 0 1.55.64 2.95 1.72 4.02L3.5 16.25l3.55-1.5c.78.28 1.6.42 2.45.42 4 0 7-2.66 7-6s-3-6.42-7-6.42Z" />
      <path d="M18.1 8.4c2.1.86 3.4 2.66 3.4 4.73 0 1.2-.46 2.3-1.25 3.2l.75 3.42-3.1-1.35c-.72.24-1.5.37-2.3.37-2.3 0-4.3-.97-5.4-2.47" />
    </svg>
  );
}

function SettingsIcon({ strokeWidth: _strokeWidth, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M9.91 3.86L10.11 1.16L13.89 1.16L14.09 3.86L16.28 4.77L18.33 3L21 5.67L19.23 7.72L20.14 9.91L22.84 10.11L22.84 13.89L20.14 14.09L19.23 16.28L21 18.33L18.33 21L16.28 19.23L14.09 20.14L13.89 22.84L10.11 22.84L9.91 20.14L7.72 19.23L5.67 21L3 18.33L4.77 16.28L3.86 14.09L1.16 13.89L1.16 10.11L3.86 9.91L4.77 7.72L3 5.67L5.67 3L7.72 4.77ZM15.6 12a3.6 3.6 0 1 0-7.2 0a3.6 3.6 0 1 0 7.2 0Z"
      />
    </svg>
  );
}

const MEMBER_ICONS = {
  anon: Mail,
  messages: MessagesIcon,
  notifications: Bell,
  bookmarks: Bookmark,
  settings: SettingsIcon,
} as const;

export function SiteMainNav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav fit-line" aria-label="Ana menü">
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
      <ul className="fit-line">
        {items.map((item) => {
          const Icon = MEMBER_ICONS[item.icon];
          const active = isNavActive(pathname, item.href);
          // On the notifications page the list is being read, so its count goes
          // at once rather than after the refresh that follows (D-164)
          const badge = item.icon === "notifications" && active ? 0 : item.badge;
          return (
            <li key={item.href}>
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden className="member-icon" strokeWidth={1.5} />
                <span>{item.label}</span>
                {badge ? (
                  <span className="member-badge">{badge > 99 ? "99+" : badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
