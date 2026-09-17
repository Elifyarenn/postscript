import { describe, expect, it } from "vitest";
import { issueExtrasFor } from "@/lib/issue-extras";
import {
  categoryImageKey,
  categorySubtitle,
  formatIssueNumber,
  isNavActive,
  memberNav,
  SOCIAL_LINKS,
  socialUrl,
} from "@/lib/site";

describe("isNavActive (D-112)", () => {
  it("lights the front page only on the front page", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/social", "/")).toBe(false);
  });

  it("matches a section and the pages under it, not a lookalike prefix", () => {
    expect(isNavActive("/social/messages", "/social/messages")).toBe(true);
    expect(isNavActive("/social/messages/kerem", "/social/messages")).toBe(true);
    expect(isNavActive("/socialize", "/social")).toBe(false);
  });

  it("never treats an anchor as a page", () => {
    expect(isNavActive("/", "/#kategoriler")).toBe(false);
    expect(isNavActive("/kategoriler", "/kategoriler")).toBe(true);
  });
});

describe("memberNav", () => {
  it("lists the designs' five entries with the unread counts on the right ones", () => {
    const items = memberNav({ anon: 2, messages: 3, notifications: 0 });
    expect(items.map((item) => item.href)).toEqual([
      "/social/anon",
      "/social/messages",
      "/social/notifications",
      "/social/bookmarks",
      "/social/settings",
    ]);
    expect(items[0]?.badge).toBe(2);
    expect(items[1]?.badge).toBe(3);
    expect(items[2]?.badge).toBe(0);
    expect(items[3]?.badge).toBeUndefined();
  });
});

describe("categoryImageKey", () => {
  it("picks the picture from a word in the area's name, Turkish casing included", () => {
    expect(categoryImageKey("Sanat & Edebiyat", 4)).toBe("art");
    expect(categoryImageKey("BİLİM & TEKNOLOJİ", 0)).toBe("science");
    expect(categoryImageKey("Psikoloji & İlişkiler", 0)).toBe("psychology");
    expect(categoryImageKey("Yaşam & Moda", 0)).toBe("lifestyle");
    expect(categoryImageKey("Popüler Kültür", 0)).toBe("pop");
    expect(categoryImageKey("Film, Dizi & Kitap", 2)).toBe("books");
  });

  it("gives each of the design's eleven areas its own photo", () => {
    const names = [
      "Sanat & Edebiyat",
      "Bilim & Teknoloji",
      "Psikoloji & İlişkiler",
      "LIFESTYLE & FASHION",
      "Pop Culture",
      "Film, Dizi & Kitap",
      "Sosyoloji & Düşünce",
      "Sosyal & Feminizm",
      "Tarih & Dünya",
      "Yazar Köşesi: P.S.",
      "Eğlence & Dedikodu",
    ];
    const keys = names.map((name) => categoryImageKey(name, 0));
    expect(keys).toEqual([
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
    ]);
  });

  it("takes the pictures in turn for a name that matches nothing", () => {
    expect(categoryImageKey("Gezi", 0)).toBe("art");
    expect(categoryImageKey("Gezi", 1)).toBe("science");
    expect(categoryImageKey("Gezi", 5)).toBe("books");
    expect(categoryImageKey("Gezi", 11)).toBe("art");
  });
});

describe("formatIssueNumber", () => {
  it("pads to two digits and leaves longer numbers alone", () => {
    expect(formatIssueNumber(1)).toBe("01");
    expect(formatIssueNumber(12)).toBe("12");
    expect(formatIssueNumber(104)).toBe("104");
  });
});

describe("issueExtrasFor", () => {
  it("has the designs' panels for issue 01 and nothing for an issue without an entry", () => {
    const cards = issueExtrasFor(1)?.cards ?? [];
    expect(cards.map((card) => card.kind)).toEqual(["movie", "series", "book", "artwork"]);
    expect(cards.at(-1)?.credit).toBe("Wojciech Weiss");
    expect(issueExtrasFor(99)).toBeNull();
  });
});

describe("SOCIAL_LINKS (D-128)", () => {
  it("links the footer's Spotify icon to the magazine's account and has no LinkedIn", () => {
    const spotify = SOCIAL_LINKS.find((link) => link.key === "spotify");
    expect(spotify?.url?.startsWith("https://open.spotify.com/user/")).toBe(true);
    expect(SOCIAL_LINKS.map((link) => link.key)).not.toContain("linkedin");
  });

  it("links every account without share tracking (D-173, D-174)", () => {
    expect(socialUrl("x")).toBe("https://x.com/postscriptmgzn");
    expect(socialUrl("tiktok")).toBe("https://www.tiktok.com/@postscriptmgzn");
    expect(socialUrl("instagram")).toBe("https://www.instagram.com/postscriptmgzn/");
    expect(socialUrl("pinterest")).toBe("https://www.pinterest.com/magpostscript/");
    for (const link of SOCIAL_LINKS) {
      if (link.url) expect(new URL(link.url).search).toBe("");
    }
  });
});

describe("issue 01 playlist songs (D-131)", () => {
  it("names the playlist and gives each song a minutes:seconds length", () => {
    const playlist = issueExtrasFor(1)?.playlist;
    expect(playlist?.name).toBe("Obsession");
    expect(playlist?.tracks?.length).toBeGreaterThan(0);
    for (const track of playlist?.tracks ?? []) {
      expect(track.title.length).toBeGreaterThan(0);
      expect(track.artist.length).toBeGreaterThan(0);
      expect(/^\d{1,2}:[0-5]\d$/.test(track.duration)).toBe(true);
    }
  });
});

describe("categorySubtitle (D-146)", () => {
  it("gives each area the line of topics the design writes under its name", () => {
    expect(categorySubtitle("Sanat & Edebiyat", 0)).toBe("resim, edebiyat,\nşiir ve dahası");
    expect(categorySubtitle("Bilim & Teknoloji", 0)).toBe("atom, nörobilim,\nyapay zekâ ve dahası");
    expect(categorySubtitle("Film, Dizi & Kitap", 0)).toBe("film, dizi, kitap\nve dahası");
    expect(categorySubtitle("Yazar Köşesi: P.S.", 0)).toBe("anlatı, deneyim,\nyazar köşesi ve dahası");
  });

  it("falls back to the line that belongs to the picture a strange name was given", () => {
    expect(categorySubtitle("Gezi", 0)).toBe(categorySubtitle("Sanat & Edebiyat", 0));
  });
});
