import { describe, expect, it } from "vitest";
import {
  isSitePath,
  notificationTab,
  parseNotificationTab,
  splitLeadingHandle,
} from "@/lib/notification-view";
import { formatClockTime, formatDayLabel, formatRelativeTime } from "@/lib/relative-time";

describe("notification tabs (D-113)", () => {
  it("files each stored kind under its tab, the magazine's own under Dergi", () => {
    expect(notificationTab("social.follow")).toBe("takip");
    expect(notificationTab("social.like")).toBe("begeni");
    expect(notificationTab("social.repost")).toBe("begeni");
    expect(notificationTab("social.reply")).toBe("yanit");
    expect(notificationTab("editorial")).toBe("dergi");
    expect(notificationTab("kvkk.new_version")).toBe("dergi");
  });

  it("reads an unknown tab as all", () => {
    expect(parseNotificationTab("begeni")).toBe("begeni");
    expect(parseNotificationTab("mentions")).toBe("tumu");
    expect(parseNotificationTab(undefined)).toBe("tumu");
  });
});

describe("splitLeadingHandle", () => {
  it("separates a leading handle from the sentence", () => {
    expect(splitLeadingHandle("@ada_yazar sizi takip etmeye başladı.")).toEqual({
      handle: "ada_yazar",
      rest: "sizi takip etmeye başladı.",
    });
  });

  it("leaves a title without a handle whole", () => {
    expect(splitLeadingHandle("Yazınız yayımlandı.")).toEqual({ handle: null, rest: "Yazınız yayımlandı." });
    expect(splitLeadingHandle("@ tek başına")).toEqual({ handle: null, rest: "@ tek başına" });
  });
});

describe("isSitePath", () => {
  it("follows only paths on this site", () => {
    expect(isSitePath("/social/posts/1")).toBe(true);
    expect(isSitePath("https://example.com")).toBe(false);
    expect(isSitePath("//example.com/x")).toBe(false);
    expect(isSitePath("/\\example.com")).toBe(false);
    expect(isSitePath(null)).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it("counts minutes, hours and days, then gives the date", () => {
    expect(formatRelativeTime(ago(20), now)).toBe("az önce");
    expect(formatRelativeTime(ago(-30), now)).toBe("az önce");
    expect(formatRelativeTime(ago(5 * 60), now)).toBe("5 dakika önce");
    expect(formatRelativeTime(ago(2 * 3600), now)).toBe("2 saat önce");
    expect(formatRelativeTime(ago(26 * 3600), now)).toBe("dün");
    expect(formatRelativeTime(ago(10 * 86400), now)).toBe("5 Eylül 2026");
  });
});

describe("message times", () => {
  it("dates and clocks in Istanbul time, not the server's UTC", () => {
    const lateEvening = new Date("2026-09-14T21:30:00Z");
    expect(formatDayLabel(lateEvening)).toBe("15 Eylül 2026");
    expect(formatClockTime(lateEvening)).toBe("00:30");
  });
});
