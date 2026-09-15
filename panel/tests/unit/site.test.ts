import { describe, expect, it } from "vitest";
import { issueExtrasFor } from "@/lib/issue-extras";
import { categoryImageKey, formatIssueNumber, isNavActive, memberNav, SOCIAL_LINKS } from "@/lib/site";

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
});
