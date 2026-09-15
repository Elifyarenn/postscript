/**
 * How the notifications screen sorts and shows what `notifications` holds
 * (D-113, tabs as in the design since D-116). Pure, so the rules are unit tested.
 */

export const NOTIFICATION_TABS = [
  { key: "tumu", label: "Tümü" },
  { key: "takip", label: "Takipçiler" },
  { key: "begeni", label: "Beğeniler" },
  { key: "yorum", label: "Yorumlar" },
  { key: "bahsetme", label: "Bahsetmeler" },
] as const;

export type NotificationTabKey = (typeof NOTIFICATION_TABS)[number]["key"];

export function parseNotificationTab(value: string | undefined): NotificationTabKey {
  return NOTIFICATION_TABS.find((tab) => tab.key === value)?.key ?? "tumu";
}

/**
 * The tab a stored kind belongs to, or null when it is only shown under
 * "Tümü". Mentions have no source yet, so that tab stays empty (D-116); the
 * magazine's own notices — the editorial workflow, the privacy notice,
 * moderation — are not a member's doing and have no tab of their own in the
 * design.
 */
export function notificationTab(kind: string): Exclude<NotificationTabKey, "tumu"> | null {
  if (kind === "social.follow") return "takip";
  if (kind === "social.like" || kind === "social.repost") return "begeni";
  if (kind === "social.reply") return "yorum";
  return null;
}

/**
 * Splits "@ada_yazar sizi takip etmeye başladı." into the handle, shown in
 * bold beside its initial, and the rest. A title that does not open with a
 * handle comes back whole.
 */
export function splitLeadingHandle(title: string): { handle: string | null; rest: string } {
  const match = /^@([a-z0-9_]{3,20})(?:\s+|$)/.exec(title);
  if (!match?.[1]) return { handle: null, rest: title };
  return { handle: match[1], rest: title.slice(match[0].length) };
}

/**
 * Whether a stored link may be followed from the screen. Only a path on this
 * site: "//host" and "/\host" are read by browsers as another site, so a bare
 * "starts with a slash" check would open the door to a redirect elsewhere.
 */
export function isSitePath(href: string | null | undefined): href is string {
  if (!href?.startsWith("/")) return false;
  const second = href.charAt(1);
  return second !== "/" && second !== "\\";
}
