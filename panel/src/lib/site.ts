/**
 * What the magazine frame shows, kept as data (D-112): the main menu, the
 * member menu beside the column and the pictures of the writing areas.
 *
 * Pure so the rules can be unit tested; the components only render them.
 */

export type SiteNavItem = { href: string; label: string };

/** The header menu, in the designs' order. */
export const SITE_NAV: SiteNavItem[] = [
  { href: "/", label: "Ana sayfa" },
  { href: "/#kategoriler", label: "Kategoriler" },
  { href: "/hakkinda", label: "Hakkında" },
  { href: "/magazine/issues", label: "Sayılar" },
  { href: "/social", label: "Topluluk" },
  { href: "/iletisim", label: "İletişim" },
];

export type MemberNavIcon = "anon" | "messages" | "notifications" | "bookmarks" | "settings";

export type MemberNavItem = SiteNavItem & { icon: MemberNavIcon; badge?: number };

export type MemberNavState = {
  /** Unread messages in the anonymous box. */
  anon: number;
  /** Conversations with unread messages. */
  messages: number;
  notifications: number;
};

/** The five entries of the designs' member menu, with their unread counts. */
export function memberNav(state: MemberNavState): MemberNavItem[] {
  return [
    { href: "/social/anon", label: "Anonim kutu", icon: "anon", badge: state.anon },
    { href: "/social/messages", label: "Mesajlar", icon: "messages", badge: state.messages },
    {
      href: "/social/notifications",
      label: "Bildirimler",
      icon: "notifications",
      badge: state.notifications,
    },
    { href: "/social/bookmarks", label: "Kaydedilenler", icon: "bookmarks" },
    { href: "/social/settings", label: "Ayarlar", icon: "settings" },
  ];
}

/**
 * The community pages the designs' menu leaves out. They stay one click away
 * under the member menu, or the feed, Keşfet and the communities would only
 * be reachable by typing their address.
 */
export const MEMBER_EXTRA_NAV: SiteNavItem[] = [
  { href: "/social", label: "Akış" },
  { href: "/social/explore", label: "Keşfet" },
  { href: "/social/communities", label: "Topluluklar" },
];

/**
 * Whether a menu link belongs to the page being shown. An anchor ("/#…") is a
 * place on a page, never a page of its own, and the front page matches only
 * itself or every link would light it up.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href.includes("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type CategoryImageKey = "art" | "science" | "psychology" | "lifestyle" | "pop";

const CATEGORY_IMAGE_ORDER: CategoryImageKey[] = ["art", "science", "psychology", "lifestyle", "pop"];

/** Words in an area's name that pick its picture; the first match wins. */
const CATEGORY_KEYWORDS: [CategoryImageKey, string[]][] = [
  ["art", ["sanat", "edebiyat", "şiir", "öykü"]],
  ["science", ["bilim", "teknoloji"]],
  ["psychology", ["psikoloji", "ilişki"]],
  ["lifestyle", ["yaşam", "moda", "stil"]],
  ["pop", ["pop", "kültür", "müzik", "sinema", "film", "dizi", "kitap"]],
];

/**
 * The designs' picture for a writing area. Areas are named by the admin, so
 * the name is matched loosely; one that matches nothing takes the pictures in
 * turn by its position, and neighbours rarely repeat.
 */
export function categoryImageKey(name: string, index: number): CategoryImageKey {
  const lowered = name.toLocaleLowerCase("tr");
  for (const [key, words] of CATEGORY_KEYWORDS) {
    if (words.some((word) => lowered.includes(word))) return key;
  }
  return CATEGORY_IMAGE_ORDER[Math.abs(index) % CATEGORY_IMAGE_ORDER.length] ?? "art";
}

/** "SAYI 01": issue numbers are shown with two digits, as on the cover. */
export function formatIssueNumber(issueNumber: number): string {
  return String(issueNumber).padStart(2, "0");
}

export type SocialKey = "x" | "tiktok" | "linkedin" | "instagram" | "pinterest";

export type SocialLink = { key: SocialKey; label: string; url: string | null };

/**
 * The magazine's accounts in the footer's "arkadaş olalım!" row (D-116).
 * The addresses are not known yet: an icon without one is drawn as designed
 * but is not a link, so nobody is sent to a page that does not exist.
 */
export const SOCIAL_LINKS: SocialLink[] = [
  { key: "x", label: "X", url: null },
  { key: "tiktok", label: "TikTok", url: null },
  { key: "linkedin", label: "LinkedIn", url: null },
  { key: "instagram", label: "Instagram", url: null },
  { key: "pinterest", label: "Pinterest", url: null },
];
