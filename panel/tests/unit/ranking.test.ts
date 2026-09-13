import { describe, expect, it } from "vitest";
import { mergeTimeline, rankExplorePosts, rankSuggestions } from "@/lib/ranking";
import { isReportOverdue, reportDeadline } from "@/lib/reports";

const at = (iso: string) => new Date(iso);

describe("timeline merge (D-090)", () => {
  it("orders by activity and keeps each post once, at its latest activity", () => {
    const merged = mergeTimeline(
      [
        { postId: "a", at: at("2026-09-01T10:00:00Z"), via: "post" },
        { postId: "b", at: at("2026-09-02T10:00:00Z"), via: "post" },
        { postId: "a", at: at("2026-09-03T10:00:00Z"), via: "repost" },
      ],
      10,
    );
    expect(merged.map((entry) => `${entry.postId}:${entry.via}`)).toEqual(["a:repost", "b:post"]);
  });

  it("stops at the limit", () => {
    const entries = ["a", "b", "c"].map((postId, index) => ({
      postId,
      at: new Date(Date.UTC(2026, 8, index + 1)),
    }));
    expect(mergeTimeline(entries, 2).map((entry) => entry.postId)).toEqual(["c", "b"]);
  });
});

describe("explore ranking", () => {
  it("ranks likes, then reposts, then recency", () => {
    const ranked = rankExplorePosts([
      { id: "old-popular", likeCount: 5, repostCount: 0, createdAt: at("2026-09-01T00:00:00Z") },
      { id: "reposted", likeCount: 2, repostCount: 3, createdAt: at("2026-09-02T00:00:00Z") },
      { id: "new", likeCount: 2, repostCount: 0, createdAt: at("2026-09-05T00:00:00Z") },
      { id: "older", likeCount: 2, repostCount: 0, createdAt: at("2026-09-04T00:00:00Z") },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["old-popular", "reposted", "new", "older"]);
  });
});

describe("member suggestions", () => {
  it("ranks friends of friends by how many follow them and skips the excluded", () => {
    const ranked = rankSuggestions(["x", "y", "x", "me", "z", "y", "x"], new Set(["me", "z"]));
    expect(ranked).toEqual(["x", "y"]);
  });
});

describe("report deadline (5651 m. 9)", () => {
  it("is twenty-four hours after the report", () => {
    const created = at("2026-09-13T08:00:00Z");
    expect(reportDeadline(created).toISOString()).toBe("2026-09-14T08:00:00.000Z");
    expect(isReportOverdue(created, at("2026-09-14T08:00:00Z"))).toBe(false);
    expect(isReportOverdue(created, at("2026-09-14T08:00:01Z"))).toBe(true);
  });
});
