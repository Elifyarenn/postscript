import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { requireSession } from "@/lib/auth/guard";
import { readCsrfToken } from "@/lib/csrf";
import {
  isSitePath,
  NOTIFICATION_TABS,
  notificationTab,
  parseNotificationTab,
  splitLeadingHandle,
} from "@/lib/notification-view";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn, formatDateTime } from "@/lib/utils";
import { listNotifications } from "@/services/notifications";
import { ActionButton } from "@/components/form";
import { SiteTitle } from "@/components/site-ui";
import { markNotificationsReadAction } from "../actions";

export const metadata = { title: "Bildirimler" };

/** The design rules the page into rows all the way down; empty rows fill it to this many. */
const RULED_ROWS = 8;

const EMPTY_TEXT = {
  tumu: "Henüz bildirim yok.",
  takip: "Henüz takipçi bildirimi yok.",
  begeni: "Henüz beğeni bildirimi yok.",
  yorum: "Henüz yorum bildirimi yok.",
  bahsetme: "Henüz bahsetme yok.",
} as const;

/** The member's notifications, sorted into the design's tabs (D-113, D-116). */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string }>;
}) {
  const { user } = await requireSession();
  const csrfToken = (await readCsrfToken()) ?? "";
  const [items, params] = await Promise.all([listNotifications({ ...user }), searchParams]);

  const tab = parseNotificationTab(params.tur);
  const shown = tab === "tumu" ? items : items.filter((item) => notificationTab(item.kind) === tab);
  const hasUnread = items.some((item) => item.readAt === null);
  const fillerRows = Math.max(0, RULED_ROWS - Math.max(shown.length, 1));

  return (
    <>
      <SiteTitle>Bildirimler</SiteTitle>

      <div className="notice-bar">
        <nav className="site-tabs" aria-label="Bildirim türleri">
          {NOTIFICATION_TABS.map((item) => (
            <Link
              key={item.key}
              href={item.key === "tumu" ? "/social/notifications" : `/social/notifications?tur=${item.key}`}
              aria-current={item.key === tab ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {hasUnread && (
          <ActionButton
            action={markNotificationsReadAction}
            csrfToken={csrfToken}
            label="Tümünü okundu işaretle"
            variant="ghost"
            className="notice-mark"
            display={
              <>
                <Check aria-hidden className="size-4" />
                Tümünü okundu işaretle
              </>
            }
          />
        )}
      </div>

      <ul className="notice-list">
        {shown.length === 0 && <li className="notice-empty">{EMPTY_TEXT[tab]}</li>}

        {shown.map((item) => {
          const { handle, rest } = splitLeadingHandle(item.title);
          const unread = item.readAt === null;
          const text = handle ? (
            <>
              <strong>@{handle}</strong> {rest}
            </>
          ) : (
            rest
          );

          return (
            <li key={item.id} className={cn("notice-item", unread && "is-unread")}>
              <span className="notice-avatar" aria-hidden>
                {handle ? handle.charAt(0) : <Bell className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="notice-title">
                  {/* Only in-site paths become links; a stored href is never trusted as external */}
                  {isSitePath(item.href) ? <Link href={item.href}>{text}</Link> : text}
                </p>
                {item.body && <p className="notice-body">“{item.body}”</p>}
              </div>
              <time
                className="notice-time"
                dateTime={item.createdAt.toISOString()}
                title={formatDateTime(item.createdAt)}
              >
                {formatRelativeTime(item.createdAt)}
              </time>
              <span className={unread ? "notice-dot" : "notice-dot is-read"}>
                {unread && <span className="sr-only">Okunmadı</span>}
              </span>
            </li>
          );
        })}

        {Array.from({ length: fillerRows }, (_, index) => (
          <li key={`rule-${index}`} className="notice-filler" aria-hidden />
        ))}
      </ul>
    </>
  );
}
