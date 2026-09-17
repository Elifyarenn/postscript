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
  { href: "/kategoriler", label: "Kategoriler" },
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

export type CategoryImageKey =
  | "art"
  | "science"
  | "psychology"
  | "lifestyle"
  | "pop"
  | "books"
  | "thought"
  | "feminism"
  | "history"
  | "author"
  | "gossip";

/** The design's category photos, left to right as it places them (D-122). */
const CATEGORY_IMAGE_ORDER: CategoryImageKey[] = [
  "art",
  "science",
  "psychology",
  "lifestyle",
  "pop",
  "books",
  "thought",
  "feminism",
  "history",
  "author",
  "gossip",
];

/**
 * Words in an area's name that pick its picture; the first match wins. The
 * design names its areas in English and the site in Turkish, so both count.
 */
const CATEGORY_KEYWORDS: [CategoryImageKey, string[]][] = [
  ["art", ["sanat", "edebiyat", "şiir", "öykü", "literature"]],
  ["science", ["bilim", "teknoloji", "science", "technology"]],
  ["psychology", ["psikoloji", "ilişki", "psychology", "relationship"]],
  ["lifestyle", ["yaşam", "moda", "stil", "lifestyle", "fashion"]],
  ["books", ["film", "dizi", "kitap", "sinema", "series", "book", "movie"]],
  ["pop", ["pop", "kültür", "müzik", "culture", "music"]],
  ["thought", ["sosyoloji", "düşünce", "felsefe", "sociology", "thought", "philosophy"]],
  ["feminism", ["sosyal", "feminizm", "kadın", "social", "feminism"]],
  ["history", ["tarih", "dünya", "history", "world"]],
  ["author", ["yazar", "köşe", "author"]],
  ["gossip", ["eğlence", "dedikodu", "magazin", "entertainment", "gossip"]],
];

/**
 * The designs' picture for a writing area. Areas are named by the admin, so
 * the name is matched loosely; one that matches nothing takes the pictures in
 * turn by its position, and neighbours rarely repeat.
 */
export function categoryImageKey(name: string, index: number): CategoryImageKey {
  // Turkish lower case turns an English capital I into a dotless ı, which no keyword has
  const lowered = name.toLocaleLowerCase("tr").replaceAll("ı", "i");
  for (const [key, words] of CATEGORY_KEYWORDS) {
    if (words.some((word) => lowered.includes(word))) return key;
  }
  return CATEGORY_IMAGE_ORDER[Math.abs(index) % CATEGORY_IMAGE_ORDER.length] ?? "art";
}

/**
 * The topics written under a category's name in the designs (D-146), keyed by
 * the same picture key, so an area whose name matches nothing still gets the
 * line that belongs to its picture.
 */
// "\n" is where the categories design breaks the line (D-169)
const CATEGORY_SUBTITLES: Record<CategoryImageKey, string> = {
  art: "resim, edebiyat,\nşiir ve dahası",
  science: "atom, nörobilim,\nyapay zekâ ve dahası",
  psychology: "ruh hali, duygular,\nburç, ilişkiler ve dahası",
  lifestyle: "moda, sağlık,\ngüzellik ve dahası",
  pop: "müzik, ünlüler, dans,\ndedikodu ve dahası",
  books: "film, dizi, kitap\nve dahası",
  thought: "felsefe, kavram,\ndüşünceler ve dahası",
  feminism: "ekonomi, topluluk,\ngündem ve dahası",
  history: "tarih, mimari,\ntarihi eser ve dahası",
  author: "anlatı, deneyim,\nyazar köşesi ve dahası",
  gossip: "dedikodu, itiraf,\nquiz ve dahası",
};

/** The design's line of example topics for a writing area. */
export function categorySubtitle(name: string, index: number): string {
  return CATEGORY_SUBTITLES[categoryImageKey(name, index)];
}

/** "SAYI 01": issue numbers are shown with two digits, as on the cover. */
export function formatIssueNumber(issueNumber: number): string {
  return String(issueNumber).padStart(2, "0");
}

export type SocialKey = "x" | "tiktok" | "spotify" | "instagram" | "pinterest";

export type SocialLink = { key: SocialKey; label: string; url: string | null };

/**
 * The magazine's accounts in the footer's "arkadaş olalım!" row (D-116).
 * An icon without an address is drawn as designed but is not a link, so
 * nobody is sent to a page that does not exist. The addresses are kept without
 * the share links' tracking parameters (D-173).
 */
export const SOCIAL_LINKS: SocialLink[] = [
  { key: "x", label: "X", url: "https://x.com/postscriptmgzn" },
  { key: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@postscriptmgzn" },
  // The account that owns the issue playlists (D-117, D-128)
  { key: "spotify", label: "Spotify", url: "https://open.spotify.com/user/31ni3zrhtxradpywcotdp4jr6k2y" },
  { key: "instagram", label: "Instagram", url: "https://www.instagram.com/postscriptmgzn/" },
  { key: "pinterest", label: "Pinterest", url: null },
];

/** The address of one of the magazine's accounts, or null when it has none yet. */
export function socialUrl(key: SocialKey): string | null {
  return SOCIAL_LINKS.find((link) => link.key === key)?.url ?? null;
}
